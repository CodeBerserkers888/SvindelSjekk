import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "no";
type Verdict = "FARLIG" | "MISTENKELIG" | "TRYGG";

interface CheckResult {
  verdict: Verdict;
  emoji: "🚨" | "⚠️" | "✅";
  title: string;
  explanation: string;
  tips: string[];
  sources: string[];
}

interface DestroyResult {
  threat: boolean;
  severity: "critical" | "high" | "medium" | "low" | "none";
  risk_score: number;
  flags?: string[];
  matched_keywords?: string[];
}

// ─── Keyword patterns ────────────────────────────────────────────────────────

const DANGER_PATTERNS = [
  /bankid/i,
  /passord/i,
  /kredittkort/i,
  /personnummer/i,
  /kontonummer/i,
  /bank.?konto/i,
  /verifiser.{0,20}konto/i,
  /konto.{0,20}sperr/i,
  /din konto er/i,
  /du har vunnet/i,
  /klikk her umiddelbart/i,
  /logg inn n[åa]/i,
  /bekreft.{0,20}identitet/i,
  /utløper.{0,20}i dag/i,
  /mistet.{0,20}tilgang/i,
];

const SUSPICIOUS_PATTERNS = [
  /klikk her/i,
  /haster/i,
  /gratis/i,
  /bekreft/i,
  /levering.{0,20}pakke/i,
  /toll.{0,10}avgift/i,
  /send oss/i,
  /svar umiddelbart/i,
  /begrenset tid/i,
  /ikke ignorer/i,
];

const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/i,
  /tinyurl/i,
  /shorturl/i,
  /ow\.ly/i,
  /rb\.gy/i,
  /cutt\.ly/i,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /[a-z0-9-]+\.(xyz|top|click|loan|win|gq|ml|cf|tk|pw|work|racing|party|review|trade|download|men)\b/i,
  /dnb-/i,
  /vipps-/i,
  /sparebank-/i,
  /nav-/i,
  /posten-/i,
];

// ─── Norwegian responses ──────────────────────────────────────────────────────

const RESPONSES: Record<Verdict, { title: string; explanation: string; tips: string[] }> = {
  FARLIG: {
    title: "Dette er sannsynligvis svindel!",
    explanation: "Meldingen inneholder tegn som er typiske for svindel i Norge. Ikke klikk på lenker og ikke del personlig informasjon.",
    tips: [
      "Ikke svar på meldingen",
      "Ikke klikk på noen lenker",
      "Ring banken din direkte på nummeret bak kortet",
      "Anmeld til Politiet på 02800",
    ],
  },
  MISTENKELIG: {
    title: "Vær forsiktig – mistenkelig melding",
    explanation: "Noe i denne meldingen ser ikke helt riktig ut. Det kan være svindel. Vær forsiktig før du gjør noe.",
    tips: [
      "Ikke hast deg – ta deg tid til å tenke",
      "Ring den som angivelig sendte meldingen på et kjent nummer",
      "Spør en du stoler på om hjelp",
    ],
  },
  TRYGG: {
    title: "Ser trygt ut",
    explanation: "Vi fant ingen kjente svindeltegn i denne meldingen. Men vær alltid forsiktig med ukjente avsendere.",
    tips: [
      "Husk at ingen bank ber om passord på SMS",
      "Ved tvil, ring banken direkte",
    ],
  },
};

// ─── URL extractor ────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  return text.match(urlRegex) || [];
}

// ─── Google Safe Browsing ─────────────────────────────────────────────────────

async function checkGoogleSafeBrowsing(urls: string[]): Promise<boolean> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey || urls.length === 0) return false;

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "svindelsjekk", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: urls.map((url) => ({ url })),
          },
        }),
      }
    );
    const data = await res.json();
    return !!(data.matches && data.matches.length > 0);
  } catch {
    return false;
  }
}

// ─── destroy.tools API v1 ─────────────────────────────────────────────────────

async function checkDestroyTools(urls: string[]): Promise<{ hit: boolean; critical: boolean }> {
  if (urls.length === 0) return { hit: false, critical: false };

  for (const url of urls) {
    try {
      const domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
      const res = await fetch(`https://api.destroy.tools/v1/check?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) continue;
      const data: DestroyResult = await res.json();

      if (data.threat && data.risk_score >= 60) {
        return {
          hit: true,
          critical: data.severity === "critical" || data.risk_score >= 80,
        };
      }
    } catch {
      continue;
    }
  }
  return { hit: false, critical: false };
}

// ─── URLhaus (abuse.ch) ───────────────────────────────────────────────────────

async function checkURLhaus(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;

  for (const url of urls) {
    try {
      const formData = new URLSearchParams();
      formData.append("url", url);

      const res = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!res.ok) continue;
      const data = await res.json();

      // query_status: "is_host" = found in database as malicious
      if (data.query_status === "is_url" && data.url_status === "online") {
        return true;
      }
      if (data.query_status === "is_url" && data.url_status === "unknown") {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { text, lang = "no" } = (await req.json()) as { text: string; lang: Lang };

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ error: "Teksten er for kort" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Teksten er for lang" }, { status: 400 });
    }

    const urls = extractUrls(text);
    const sources: string[] = [];

    // Sjekk alle API-er parallelt
    const [googleHit, destroyResult, urlhausHit] = await Promise.all([
      checkGoogleSafeBrowsing(urls),
      checkDestroyTools(urls),
      checkURLhaus(urls),
    ]);

    if (googleHit) sources.push("Google Safe Browsing");
    if (destroyResult.hit) sources.push("destroy.tools");
    if (urlhausHit) sources.push("URLhaus");

    // Mønsteranalyse
    const hasDangerKeyword = DANGER_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousKeyword = SUSPICIOUS_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousUrl = urls.some((u) => SUSPICIOUS_URL_PATTERNS.some((p) => p.test(u)));

    if (hasDangerKeyword) sources.push("nøkkelord-analyse");
    if (hasSuspiciousUrl) sources.push("mistenkelig URL-mønster");

    // Fastsett resultat
    let verdict: Verdict;
    if (googleHit || destroyResult.critical || hasDangerKeyword || urlhausHit) {
      verdict = "FARLIG";
    } else if (destroyResult.hit || hasSuspiciousKeyword || hasSuspiciousUrl) {
      verdict = "MISTENKELIG";
    } else {
      verdict = "TRYGG";
    }

    const result: CheckResult = {
      verdict,
      emoji: verdict === "FARLIG" ? "🚨" : verdict === "MISTENKELIG" ? "⚠️" : "✅",
      ...RESPONSES[verdict],
      sources,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Check API feil:", err);
    return NextResponse.json({ error: "Analyse mislyktes" }, { status: 500 });
  }
}