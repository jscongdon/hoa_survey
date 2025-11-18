import { log, error as logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        responses: {
          include: {
            member: true,
            answers: true,
          },
          where: {
            submittedAt: { not: null },
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Build CSV
    const headers = [
      "Lot",
      "Name",
      "Email",
      "Submitted At",
      "Signed",
      "Signed At",
    ];
    survey.questions.forEach((q) => {
      headers.push(q.text);
    });

    const rows: string[][] = [];
    rows.push(headers);

    survey.responses.forEach((response) => {
      // Convert Answer[] to answers object
      const answers = response.answers.reduce(
        (acc, answer) => {
          try {
            acc[answer.questionId] = JSON.parse(answer.value);
          } catch {
            acc[answer.questionId] = answer.value;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      const row = [
        response.member.lot,
        response.member.name,
        response.member.email,
        response.submittedAt
          ? new Date(response.submittedAt).toLocaleString()
          : "",
        response.signed ? "Yes" : "No",
        response.signedAt ? new Date(response.signedAt).toLocaleString() : "",
      ];

      survey.questions.forEach((q) => {
        const answer = answers[q.id];
        if (answer === undefined || answer === null) {
          row.push("");
        } else if (Array.isArray(answer)) {
          row.push(answer.join("; "));
        } else {
          row.push(String(answer));
        }
      });

      rows.push(row);
    });

    // Convert to CSV string
    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, newline, or quote
            const cellStr = String(cell);
            if (
              cellStr.includes(",") ||
              cellStr.includes("\n") ||
              cellStr.includes('"')
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      )
      .join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.csv"`,
      },
    });
  } catch (error) {
    logError("Error exporting survey:", error);
    return NextResponse.json(
      { error: "Failed to export survey" },
      { status: 500 }
    );
  }
}
