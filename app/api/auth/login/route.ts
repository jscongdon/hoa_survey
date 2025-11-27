import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { loginSchema } from "@/lib/validation/schemas";
import { ZodError } from "zod";
import { encryptAdminData, decryptAdminData } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Find admin by email. Try encrypted lookup first, then fall back to plain text.
    const encryptedEmail = (await encryptAdminData({ email })).email;
    let admin = await prisma.admin.findUnique({
      where: { email: encryptedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        twoFactor: true,
        secret2FA: true,
        name: true,
      },
    });

    if (!admin) {
      // Fall back to plain-text email lookup to handle existing plain records
      admin = await prisma.admin.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          twoFactor: true,
          secret2FA: true,
          name: true,
        },
      });
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if admin has verified their email (LIMITED role means unverified)
    if (admin.role === "LIMITED") {
      // For display purposes, try to decrypt if encrypted, otherwise use as-is
      let displayEmail = admin.email;
      try {
        const decryptedData = await decryptAdminData({
          email: admin.email,
          name: admin.name || "",
        });
        displayEmail = decryptedData.email;
      } catch (error) {
        // If decryption fails, email is probably plain text, use as-is
        displayEmail = admin.email;
      }

      return NextResponse.json(
        {
          error: "Please verify your email address to activate your account.",
          needsVerification: true,
          email: displayEmail,
        },
        { status: 403 }
      );
    }

    // If 2FA required, short-circuit
    if (admin.twoFactor && admin.secret2FA) {
      return NextResponse.json({ requiresTwoFactor: true, adminId: admin.id });
    }

    // For JWT, try to decrypt email if encrypted, otherwise use as-is
    let jwtEmail = admin.email;
    try {
      const decryptedData = await decryptAdminData({
        email: admin.email,
        name: admin.name || "",
      });
      jwtEmail = decryptedData.email;
    } catch (error) {
      // If decryption fails, email is probably plain text, use as-is
      jwtEmail = admin.email;
    }

    const token = await signToken({
      adminId: admin.id,
      email: jwtEmail,
      role: admin.role,
    });
    const res = NextResponse.json({ success: true });
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });
    return res;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    // Log the error server-side for debugging (temporary)
    try {
      // eslint-disable-next-line no-console
      console.error("[API][auth/login] Unexpected error:", error);
    } catch (e) {
      // ignore logging errors
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
