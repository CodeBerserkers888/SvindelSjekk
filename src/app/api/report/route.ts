import { NextRequest, NextResponse } from "next/server";

// In production you would save this to a database (e.g. Supabase, PlanetScale)
// For now we log it server-side and return success
export async function POST(req: NextRequest) {
  try {
    const { text, note, verdict, lang } = await req.json();

    // TODO: Save to database
    console.log("[SCAM REPORT]", {
      timestamp: new Date().toISOString(),
      lang,
      verdict,
      note: note || "(no note)",
      textPreview: text?.slice(0, 100),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: "Report failed" }, { status: 500 });
  }
}
