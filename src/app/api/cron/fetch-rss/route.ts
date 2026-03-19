import { NextRequest, NextResponse } from "next/server";

const RSS_SOURCES = [
  {
    name: "Forbrukerrådet",
    url: "https://www.forbrukerradet.no/feed/",
    category: "advarsel",
  },
  {
    name: "NRK Norge",
    url: "https://www.nrk.no/nyheter/rss.xml",
    category: "svindel",
  },
  {
    name: "VG Nyheter",
    url: "https://www.vg.no/rss/feed/forsiden/",
    category: "svindel",
  },
  {
    name: "Aftenposten",
    url: "https://www.aftenposten.no/rss/",
    category: "advarsel",
  },
];

const SCAM_KEYWORDS = [
  "svindel", "phishing", "bedrageri", "falsk", "svindler",
  "identitetstyveri", "bankid", "sikkerhetsvarsel", "advarsel",
  "svindelforsøk", "nettsvindel", "smishing", "vishing",
  "svindlere", "lure", "falske meldinger", "falsk sms",
];

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
  for (const match of itemMatches) {
    const item = match[1];
    const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() || "";
    const link = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)?.[1]?.trim() ||
                 item.match(/<link\s+href="([^"]+)"/)?.[1]?.trim() || "";
    const description = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s)?.[1]
      ?.replace(/<[^>]+>/g, "")?.trim()?.slice(0, 500) || "";
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || new Date().toISOString();
    if (title) items.push({ title, link, description, pubDate });
  }
  return items;
}

function isRelevant(item: RSSItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return SCAM_KEYWORDS.some((kw) => text.includes(kw));
}

function generateSlug(title: string, pubDate: string): string {
  const date = new Date(pubDate);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const slug = title.toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60)
    .replace(/-+$/, "");
  return `${slug}-${dateStr}`;
}

async function slugExists(slug: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

async function insertPost(post: {
  title: string; slug: string; summary: string;
  content: string; category: string; published_at: string;
}): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...post, published: true }),
    });
    return res.ok;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { fetched: 0, relevant: 0, inserted: 0, skipped: 0, errors: [] as string[] };

  for (const source of RSS_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "SvindelSjekk RSS Bot/1.0 (+https://svindelsjekk.no)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { results.errors.push(`${source.name}: HTTP ${res.status}`); continue; }

      const xml = await res.text();
      const items = parseRSS(xml);
      results.fetched += items.length;

      for (const item of items) {
        if (!isRelevant(item)) continue;
        results.relevant++;

        const slug = generateSlug(item.title, item.pubDate);
        if (!slug) continue;

        const exists = await slugExists(slug);
        if (exists) { results.skipped++; continue; }

        const pubDate = (() => { try { return new Date(item.pubDate).toISOString(); } catch { return new Date().toISOString(); } })();

        const inserted = await insertPost({
          title: item.title,
          slug,
          summary: (item.description.slice(0, 200) || item.title),
          content: `${item.description}\n\nKilde: ${source.name}\n${item.link}`,
          category: source.category,
          published_at: pubDate,
        });
        if (inserted) results.inserted++;
        else results.errors.push(`Failed: ${item.title.slice(0, 50)}`);
      }
    } catch (err) {
      results.errors.push(`${source.name}: ${String(err).slice(0, 100)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}