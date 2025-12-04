import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, generateBaseEmail } from "@/lib/email/send";
import { getBaseUrl } from "@/lib/app-url";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the response
    const response = await prisma.response.findUnique({
      where: { token },
      include: {
        survey: true,
        member: true,
      },
    });

    if (!response) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (!response.submittedAt) {
      return NextResponse.json(
        { error: "Response must be submitted first" },
        { status: 400 }
      );
    }

    if (response.signed) {
      return NextResponse.json(
        { error: "Response is already signed" },
        { status: 400 }
      );
    }

    // Generate a unique signature token
    const signatureToken = crypto.randomBytes(32).toString("hex");

    // Update the response with the signature token
    await prisma.response.update({
      where: { id: response.id },
      data: { signatureToken },
    });

    // Send signature request email
    const baseUrl = await getBaseUrl();
    const signatureUrl = `${baseUrl}/survey/${token}/sign/${signatureToken}`;

    const bodyHtml = `
      <p>Your survey response for <strong>"${response.survey.title}"</strong> has been received.</p>
      <p>To validate the authenticity of your submission and finalize your response, please click the link below to digitally sign your submission:</p>
      <p><strong>Important:</strong> Once you sign your response, it can no longer be changed or edited.</p>
      <p>If you did not submit this response or do not wish to sign it, please disregard this email.</p>
    `;

    const emailHtml = generateBaseEmail(
      `Survey Response Signature Request`,
      `Hello ${response.member.name},`,
      bodyHtml,
      { text: "Sign My Response", url: signatureUrl },
      "This link will expire when the survey closes or if a new signature request is made."
    );

    await sendEmail({
      to: response.member.email,
      subject: `Signature Required: ${response.survey.title}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: "Signature request email sent successfully",
    });
  } catch (error) {
    logError("Error requesting signature:", error);
    return NextResponse.json(
      { error: "Failed to send signature request" },
      { status: 500 }
    );
  }
}
