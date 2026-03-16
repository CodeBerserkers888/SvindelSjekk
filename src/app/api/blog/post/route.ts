import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Mangler slug" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Ikke konfigurert" }, { status: 500 });
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const data = await res.json();
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (err) {
    console.error("Blog post API feil:", err);
    return NextResponse.json({ error: "Kunne ikke hente innlegg" }, { status: 500 });
  }
}