import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    let adminId = req.headers.get("x-admin-id");

    if (!adminId) {
      const token = req.cookies.get("auth-token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await verifyToken(token as string);
      if (!payload?.adminId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      adminId = payload.adminId;
    }

    const { id } = await context.params;
    const body = await req.json();
    const { lot, name, email, address } = body;

    // Validate required fields
    if (!lot || !name || !email) {
      return NextResponse.json(
        { error: "Lot, name, and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Verify list exists
    const list = await prisma.memberList.findUnique({
      where: { id },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Member list not found" },
        { status: 404 }
      );
    }

    // Create the member and connect to the list
    const newMember = await prisma.member.create({
      data: {
        lot,
        name,
        email,
        address: address || "",
        lists: {
          connect: { id },
        },
      },
    });

    // Find all ongoing surveys for this member list
    const now = new Date();
    const ongoingSurveys = await prisma.survey.findMany({
      where: {
        memberListId: id,
        closesAt: {
          gt: now,
        },
      },
    });

    // Create response records for the new member in all ongoing surveys
    for (const survey of ongoingSurveys) {
      // Generate a unique token for this response
      const token = `${survey.id}-${newMember.id}-${Date.now()}`;

      await prisma.response.create({
        data: {
          surveyId: survey.id,
          memberId: newMember.id,
          token,
          submittedAt: null,
        },
      });

      // If survey has minResponsesAll=true, increment minResponses
      if (survey.minResponsesAll) {
        await prisma.survey.update({
          where: { id: survey.id },
          data: {
            minResponses: {
              increment: 1,
            },
          },
        });
      }
    }

    return NextResponse.json(newMember);
  } catch (error) {
    logError("[MEMBER_CREATE]", error);
    return NextResponse.json(
      { error: "Failed to create member" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // auth
    let adminId = (req as any).headers?.get?.("x-admin-id");
    if (!adminId) {
      const cookieHeader = (req as any).headers?.get?.("cookie") || "";
      const match = cookieHeader.match(/auth-token=([^;]+)/);
      const token = match ? decodeURIComponent(match[1]) : null;
      if (!token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const payload = await verifyToken(token as string);
      if (!payload?.adminId)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      adminId = payload.adminId;
    }

    const url = new URL(req.url);
    const stream = url.searchParams.get("stream");
    const afterId = url.searchParams.get("afterId");

    // total count for headers
    const totalCount = await prisma.member.count({
      where: { lists: { some: { id } } },
    });

    if (stream) {
      const batchSize = 200;

      const streamBody = new ReadableStream({
        async start(controller) {
          let cursor: string | undefined = afterId || undefined;
          while (true) {
            const findOpts: any = {
              where: { lists: { some: { id } } },
              orderBy: { id: "asc" },
              take: batchSize,
            };
            if (cursor) {
              findOpts.cursor = { id: cursor };
              findOpts.skip = 1;
            }

            const rows = await prisma.member.findMany(findOpts);
            if (!rows || rows.length === 0) break;

            for (const m of rows) {
              try {
                const dec = await decryptMemberData({
                  name: m.name,
                  email: m.email,
                  address: m.address || "",
                  lot: m.lot,
                });
                const out = {
                  id: m.id,
                  lot: dec.lot || m.lot,
                  name: dec.name || m.name,
                  email: dec.email || m.email,
                  address: dec.address || m.address || "",
                };
                controller.enqueue(Buffer.from(JSON.stringify(out) + "\n"));
              } catch (e) {
                // fallback to raw
                controller.enqueue(
                  Buffer.from(
                    JSON.stringify({
                      id: m.id,
                      lot: m.lot,
                      name: m.name,
                      email: m.email,
                      address: m.address || "",
                    }) + "\n"
                  )
                );
              }
            }

            if (rows.length < batchSize) break;
            cursor = rows[rows.length - 1].id;
          }

          controller.close();
        },
      });

      return new Response(streamBody, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "X-Total-Count": String(totalCount),
        },
      });
    }

    // fallback: return full array (decrypted)
    const listMembers = await prisma.member.findMany({
      where: { lists: { some: { id } } },
      orderBy: { id: "asc" },
    });
    const decrypted = await Promise.all(
      listMembers.map(async (m) => {
        try {
          const dec = await decryptMemberData({
            name: m.name,
            email: m.email,
            address: m.address || "",
            lot: m.lot,
          });
          return {
            id: m.id,
            lot: dec.lot || m.lot,
            name: dec.name || m.name,
            email: dec.email || m.email,
            address: dec.address || m.address || "",
          };
        } catch (e) {
          return {
            id: m.id,
            lot: m.lot,
            name: m.name,
            email: m.email,
            address: m.address || "",
          };
        }
      })
    );

    return NextResponse.json({ items: decrypted, total: decrypted.length });
  } catch (err) {
    logError("[MEMBERS_STREAM]", err);
    return NextResponse.json(
      { error: "Failed to list members" },
      { status: 500 }
    );
  }
}
