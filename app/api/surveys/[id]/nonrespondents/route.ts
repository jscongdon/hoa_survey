import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { decryptMemberData } from "@/lib/encryption";

export async function GET(
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

    // Check if survey exists
    const survey = await prisma.survey.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const stream = url.searchParams.get("stream");
    const afterId = url.searchParams.get("afterId") || undefined;
    const remindersParam = url.searchParams.get("reminders");
    const reminders =
      typeof remindersParam === "string" && remindersParam !== ""
        ? parseInt(remindersParam, 10)
        : undefined;
    const minRemindersParam =
      url.searchParams.get("minReminders") ||
      url.searchParams.get("minReminder");
    const minReminders =
      typeof minRemindersParam === "string" && minRemindersParam !== ""
        ? parseInt(minRemindersParam, 10)
        : undefined;

    // If client requests streaming, send NDJSON lines as we paginate through the DB
    // Precompute memberIdsFilter for optional minReminders filter so both streaming and non-stream code can use it
    // Precompute a memberIdsFilter for the optional reminders/minReminders filters.
    // Support exact matching via `reminders=<n>` (e.g., reminders=0 for none),
    // or legacy `minReminders` for >= semantics if provided and `reminders` is absent.
    let memberIdsFilter: string[] | undefined;
    if (typeof reminders === "number" && !Number.isNaN(reminders)) {
      if (reminders < 0) {
        memberIdsFilter = undefined;
      } else if (reminders === 0) {
        // members who have zero reminders: all memberIds in responses minus those with any reminders
        const allResponses = await prisma.response.findMany({
          where: { surveyId: id, submittedAt: null },
          select: { memberId: true },
        });
        const allMemberIds = Array.from(
          new Set(allResponses.map((r) => r.memberId))
        );
        const grouped = await prisma.reminder.groupBy({
          by: ["memberId"],
          where: { surveyId: id },
          _count: { _all: true },
        });
        const withReminders = new Set(grouped.map((g) => g.memberId));
        memberIdsFilter = allMemberIds.filter((mid) => !withReminders.has(mid));
        if (!memberIdsFilter || memberIdsFilter.length === 0) {
          const emptyStream = new ReadableStream({
            start(controller) {
              controller.close();
            },
          });
          return new Response(emptyStream, {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "X-Total-Count": "0",
              "X-Total-Remaining": "0",
            },
          });
        }
      } else {
        // exact match > 0
        const grouped = await prisma.reminder.groupBy({
          by: ["memberId"],
          where: { surveyId: id },
          _count: { _all: true },
        });
        memberIdsFilter = grouped
          .filter((g) => (g._count?._all ?? 0) === reminders)
          .map((g) => g.memberId);
        if (!memberIdsFilter || memberIdsFilter.length === 0) {
          const emptyStream = new ReadableStream({
            start(controller) {
              controller.close();
            },
          });
          return new Response(emptyStream, {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "X-Total-Count": "0",
              "X-Total-Remaining": "0",
            },
          });
        }
      }
    } else if (
      typeof minReminders === "number" &&
      !Number.isNaN(minReminders)
    ) {
      if (minReminders <= 0) {
        memberIdsFilter = undefined;
      } else {
        const grouped = await prisma.reminder.groupBy({
          by: ["memberId"],
          where: { surveyId: id },
          _count: { _all: true },
        });
        memberIdsFilter = grouped
          .filter((g) => (g._count?._all ?? 0) >= minReminders)
          .map((g) => g.memberId);
        if (!memberIdsFilter || memberIdsFilter.length === 0) {
          const emptyStream = new ReadableStream({
            start(controller) {
              controller.close();
            },
          });
          return new Response(emptyStream, {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "X-Total-Count": "0",
              "X-Total-Remaining": "0",
            },
          });
        }
      }
    }
    if (stream === "1" || stream === "true") {
      // allow overriding batch size via query param for testing/tuning
      const batchSizeParam =
        url.searchParams.get("batchSize") || url.searchParams.get("batch");
      const parsed = batchSizeParam ? parseInt(batchSizeParam, 10) : NaN;
      const batchSize = Number.isFinite(parsed)
        ? Math.max(1, Math.min(2000, parsed))
        : 100;

      // compute total count upfront and expose via header so clients can render a total
      // compute overall total and remaining (after the optional cursor)
      // If the user requested a minimum number of reminders, compute members who match
      // memberIdsFilter already computed above

      const overallTotal = await prisma.response.count({
        where: {
          surveyId: id,
          submittedAt: null,
          ...(memberIdsFilter ? { memberId: { in: memberIdsFilter } } : {}),
        },
      });
      const remainingTotal = afterId
        ? await prisma.response.count({
            where: {
              surveyId: id,
              submittedAt: null,
              id: { gt: afterId },
              ...(memberIdsFilter ? { memberId: { in: memberIdsFilter } } : {}),
            },
          })
        : overallTotal;

      // Create a ReadableStream that will emit JSON lines
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async pull(controller) {
          try {
            // controller._lastId is used to persist the cursor between pulls.
            // If not set yet, fall back to the `afterId` provided by the client.
            let lastId: string | undefined =
              (controller as any)._lastId ?? afterId;
            // We will fetch batches using a cursor
            const batch = await prisma.response.findMany({
              where: {
                surveyId: id,
                submittedAt: null,
                ...(memberIdsFilter
                  ? { memberId: { in: memberIdsFilter } }
                  : {}),
              },
              include: {
                member: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    lot: true,
                    address: true,
                  },
                },
              },
              orderBy: { id: "asc" },
              take: batchSize,
              ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
            });

            if (!batch || batch.length === 0) {
              controller.close();
              return;
            }

            for (const response of batch) {
              try {
                const decryptedData = await decryptMemberData({
                  name: response.member.name,
                  email: response.member.email || "",
                  address: response.member.address || "",
                  lot: response.member.lot,
                });

                const item = {
                  responseId: response.id,
                  id: response.member.id,
                  name: decryptedData.name,
                  email: decryptedData.email,
                  lotNumber: decryptedData.lot,
                  address: decryptedData.address,
                  token: response.token,
                  // count how many reminders already sent to this member for this survey
                  reminderCount: await prisma.reminder.count({
                    where: { surveyId: id, memberId: response.member.id },
                  }),
                };

                controller.enqueue(encoder.encode(JSON.stringify(item) + "\n"));
                (controller as any)._lastId = response.id;
              } catch (error) {
                logError(
                  "Failed to decrypt member data in nonrespondents stream:",
                  error
                );
                const item = {
                  responseId: response.id,
                  id: response.member.id,
                  name: response.member.name,
                  email: response.member.email,
                  lotNumber: response.member.lot,
                  address: response.member.address,
                  token: response.token,
                  reminderCount: await prisma.reminder.count({
                    where: { surveyId: id, memberId: response.member.id },
                  }),
                };
                controller.enqueue(encoder.encode(JSON.stringify(item) + "\n"));
                (controller as any)._lastId = response.id;
              }
            }

            // If we received less than batchSize, we're done
            if (batch.length < batchSize) {
              controller.close();
            }
          } catch (err) {
            logError("[NON_RESPONDENTS_STREAM]", err);
            try {
              controller.error(err);
            } catch (e) {
              // ignore
            }
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          // keep X-Total-Count backward compatible (overall total), and include remaining count when resuming
          "X-Total-Count": String(overallTotal),
          "X-Total-Remaining": String(remainingTotal),
        },
      });
    }

    // Non-streaming: fetch all responses and return as array (backwards compatible)
    const nonStreamingWhere = {
      surveyId: id,
      submittedAt: null,
      ...(memberIdsFilter ? { memberId: { in: memberIdsFilter } } : {}),
    };
    const nonRespondents = await prisma.response.findMany({
      where: nonStreamingWhere,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            lot: true,
            address: true,
          },
        },
      },
    });

    // Format the response - include member `name` and lot number
    const formattedNonRespondents = await Promise.all(
      nonRespondents.map(async (response) => {
        try {
          const decryptedData = await decryptMemberData({
            name: response.member.name,
            email: response.member.email || "",
            address: response.member.address || "",
            lot: response.member.lot,
          });

          return {
            responseId: response.id,
            id: response.member.id,
            name: decryptedData.name,
            email: decryptedData.email,
            lotNumber: decryptedData.lot,
            address: decryptedData.address,
            token: response.token,
            reminderCount: await prisma.reminder.count({
              where: { surveyId: id, memberId: response.member.id },
            }),
          };
        } catch (error) {
          // If decryption fails, return encrypted data (for backward compatibility)
          logError("Failed to decrypt member data in nonrespondents:", error);
          return {
            responseId: response.id,
            id: response.member.id,
            name: response.member.name,
            email: response.member.email,
            lotNumber: response.member.lot,
            address: response.member.address,
            token: response.token,
            reminderCount: await prisma.reminder.count({
              where: { surveyId: id, memberId: response.member.id },
            }),
          };
        }
      })
    );

    // Sort by lot number (assuming lot is a string that may contain numbers)
    formattedNonRespondents.sort((a, b) => {
      const lotA = parseInt(a.lotNumber) || 0;
      const lotB = parseInt(b.lotNumber) || 0;
      return lotA - lotB;
    });

    return NextResponse.json(formattedNonRespondents);
  } catch (error) {
    logError("[NON_RESPONDENTS_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch nonrespondents" },
      { status: 500 }
    );
  }
}
