import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, note, verdict, lang, sources } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase env variables missing");
      return NextResponse.json({ ok: true });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    // Save report
    const reportRes = await fetch(`${supabaseUrl}/rest/v1/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        text_preview: text?.slice(0, 200),
        verdict,
        note: note || null,
        lang: lang || "no",
        sources: Array.isArray(sources) ? sources.join(", ") : sources || null,
        ip,
      }),
    });

    if (!reportRes.ok) {
      const err = await reportRes.text();
      console.error("Supabase report error:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Report API feil:", err);
    return NextResponse.json({ ok: true });
  }
}