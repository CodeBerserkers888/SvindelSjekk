import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Ikke konfigurert" }, { status: 500 });
    }

    const headers = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    const totalRes = await fetch(`${supabaseUrl}/rest/v1/reports?select=count`, {
      headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" },
    });
    const totalCount = parseInt(totalRes.headers.get("content-range")?.split("/")[1] || "0");

    const [farligRes, mistenkeligRes, tryggRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/reports?verdict=eq.FARLIG&select=count`, { headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } }),
      fetch(`${supabaseUrl}/rest/v1/reports?verdict=eq.MISTENKELIG&select=count`, { headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } }),
      fetch(`${supabaseUrl}/rest/v1/reports?verdict=eq.TRYGG&select=count`, { headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } }),
    ]);

    const farligCount = parseInt(farligRes.headers.get("content-range")?.split("/")[1] || "0");
    const mistenkeligCount = parseInt(mistenkeligRes.headers.get("content-range")?.split("/")[1] || "0");
    const tryggCount = parseInt(tryggRes.headers.get("content-range")?.split("/")[1] || "0");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRes = await fetch(
      `${supabaseUrl}/rest/v1/reports?created_at=gte.${sevenDaysAgo.toISOString()}&select=created_at,verdict&order=created_at.asc`,
      { headers }
    );
    const recentData = await recentRes.json();

    const byDay: Record<string, { farlig: number; mistenkelig: number; trygg: number }> = {};
    for (const row of recentData) {
      const day = row.created_at?.slice(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { farlig: 0, mistenkelig: 0, trygg: 0 };
      if (row.verdict === "FARLIG") byDay[day].farlig++;
      else if (row.verdict === "MISTENKELIG") byDay[day].mistenkelig++;
      else byDay[day].trygg++;
    }

    const sourcesRes = await fetch(
      `${supabaseUrl}/rest/v1/reports?select=sources&sources=not.is.null&limit=100&order=created_at.desc`,
      { headers }
    );
    const sourcesData = await sourcesRes.json();
    const sourceCounts: Record<string, number> = {};
    for (const row of sourcesData) {
      if (!row.sources) continue;
      for (const s of row.sources.split(", ")) {
        sourceCounts[s] = (sourceCounts[s] || 0) + 1;
      }
    }

    return NextResponse.json({
      total: totalCount,
      farlig: farligCount,
      mistenkelig: mistenkeligCount,
      trygg: tryggCount,
      byDay,
      topSources: Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    });
  } catch (err) {
    console.error("Stats API feil:", err);
    return NextResponse.json({ error: "Kunne ikke hente statistikk" }, { status: 500 });
  }
}