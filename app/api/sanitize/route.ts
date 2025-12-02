import { NextResponse } from "next/server";
import { sanitizeSurveyHtml } from "@/lib/sanitizeHtml";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html } = body;
    if (typeof html !== "string") {
      return NextResponse.json({ error: "html must be a string" }, { status: 400 });
    }
    const sanitized = sanitizeSurveyHtml(html);
    return NextResponse.json({ sanitized });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
