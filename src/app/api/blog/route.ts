import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Ikke konfigurert" }, { status: 500 });
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts?published=eq.true&order=published_at.desc&select=id,title,slug,summary,category,published_at`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Blog API feil:", err);
    return NextResponse.json({ error: "Kunne ikke hente innlegg" }, { status: 500 });
  }
}