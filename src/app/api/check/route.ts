import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";
import { rateLimit } from "./rate-limit";

type Lang = "no";
type Verdict = "FARLIG" | "MISTENKELIG" | "TRYGG";

interface CheckResult {
  verdict: Verdict;
  emoji: "🚨" | "⚠️" | "✅";
  title: string;
  explanation: string;
  tips: string[];
  sources: string[];
  checkedDatabases: { name: string; found: boolean; description: string }[];
}

interface DestroyResult {
  threat: boolean;
  severity: "critical" | "high" | "medium" | "low" | "none";
  risk_score: number;
}

// ─── Norwegian trusted domains for typosquatting ─────────────────────────────

const TRUSTED_DOMAINS = [
  "nav.no", "skatteetaten.no", "dnb.no", "sparebank1.no", "nordea.no",
  "vipps.no", "posten.no", "politiet.no", "helsenorge.no", "altinn.no",
  "bankid.no", "storebrand.no", "gjensidige.no", "tryg.no", "if.no",
];

// ─── Keyword patterns ────────────────────────────────────────────────────────

const DANGER_PATTERNS = [
  /bankid/i, /passord/i, /kredittkort/i, /personnummer/i, /kontonummer/i,
  /bank.?konto/i, /verifiser.{0,20}konto/i, /konto.{0,20}sperr/i,
  /din konto er/i, /du har vunnet/i, /klikk her umiddelbart/i,
  /logg inn n[åa]/i, /bekreft.{0,20}identitet/i, /utløper.{0,20}i dag/i,
  /mistet.{0,20}tilgang/i,
];

const SUSPICIOUS_PATTERNS = [
  /klikk her/i, /haster/i, /gratis/i, /bekreft/i,
  /levering.{0,20}pakke/i, /toll.{0,10}avgift/i, /send oss/i,
  /svar umiddelbart/i, /begrenset tid/i, /ikke ignorer/i,
];

const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/i, /tinyurl/i, /shorturl/i, /ow\.ly/i, /rb\.gy/i, /cutt\.ly/i,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /[a-z0-9-]+\.(xyz|top|click|loan|win|gq|ml|cf|tk|pw|work|racing|party|review|trade|download|men)\b/i,
  /dnb-/i, /vipps-/i, /sparebank-/i, /nav-/i, /posten-/i,
];

// ─── Responses ────────────────────────────────────────────────────────────────

const RESPONSES: Record<Verdict, { title: string; explanation: string; tips: string[] }> = {
  FARLIG: {
    title: "Dette er sannsynligvis svindel!",
    explanation: "Meldingen inneholder tegn som er typiske for svindel i Norge. Ikke klikk på lenker og ikke del personlig informasjon.",
    tips: ["Ikke svar på meldingen", "Ikke klikk på noen lenker", "Ring banken din direkte på nummeret bak kortet", "Anmeld til Politiet på 02800"],
  },
  MISTENKELIG: {
    title: "Vær forsiktig – mistenkelig melding",
    explanation: "Noe i denne meldingen ser ikke helt riktig ut. Det kan være svindel. Vær forsiktig før du gjør noe.",
    tips: ["Ikke hast deg – ta deg tid til å tenke", "Ring den som angivelig sendte meldingen på et kjent nummer", "Spør en du stoler på om hjelp"],
  },
  TRYGG: {
    title: "Ser trygt ut",
    explanation: "Vi fant ingen kjente svindeltegn i denne meldingen. Men vær alltid forsiktig med ukjente avsendere.",
    tips: ["Husk at ingen bank ber om passord på SMS", "Ved tvil, ring banken direkte"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch { return ""; }
}

// Levenshtein distance for typosquatting detection
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ─── Typosquatting detector ───────────────────────────────────────────────────

function checkTyposquatting(urls: string[]): { hit: boolean; matchedDomain: string } {
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;
    for (const trusted of TRUSTED_DOMAINS) {
      if (domain === trusted) continue; // exact match = safe
      const dist = levenshtein(domain, trusted);
      // Distance 1-3 = very suspicious (one letter off, hyphen added etc.)
      if (dist >= 1 && dist <= 3) {
        return { hit: true, matchedDomain: trusted };
      }
      // Also catch substrings like "nav-hjelp.com" containing "nav"
      const trustedBase = trusted.split(".")[0];
      if (domain.includes(trustedBase) && domain !== trusted) {
        return { hit: true, matchedDomain: trusted };
      }
    }
  }
  return { hit: false, matchedDomain: "" };
}

// ─── Google Safe Browsing ─────────────────────────────────────────────────────

async function checkGoogleSafeBrowsing(urls: string[]): Promise<boolean> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey || urls.length === 0) return false;
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
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
    });
    const data = await res.json();
    return !!(data.matches && data.matches.length > 0);
  } catch { return false; }
}

// ─── destroy.tools ────────────────────────────────────────────────────────────

async function checkDestroyTools(urls: string[]): Promise<{ hit: boolean; critical: boolean }> {
  if (urls.length === 0) return { hit: false, critical: false };
  for (const url of urls) {
    try {
      const domain = extractDomain(url);
      const res = await fetch(`https://api.destroy.tools/v1/check?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) continue;
      const data: DestroyResult = await res.json();
      if (data.threat && data.risk_score >= 60) {
        return { hit: true, critical: data.severity === "critical" || data.risk_score >= 80 };
      }
    } catch { continue; }
  }
  return { hit: false, critical: false };
}

// ─── URLhaus ──────────────────────────────────────────────────────────────────

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
      if (data.query_status === "is_url" && (data.url_status === "online" || data.url_status === "unknown")) return true;
    } catch { continue; }
  }
  return false;
}

// ─── VirusTotal ───────────────────────────────────────────────────────────────

async function checkVirusTotal(urls: string[]): Promise<{ hit: boolean; critical: boolean }> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey || urls.length === 0) return { hit: false, critical: false };
  for (const url of urls) {
    try {
      const urlId = Buffer.from(url).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, { headers: { "x-apikey": apiKey } });
      if (res.status === 404 || !res.ok) continue;
      const data = await res.json();
      const stats = data?.data?.attributes?.last_analysis_stats;
      if (!stats) continue;
      const malicious = stats.malicious ?? 0;
      const suspicious = stats.suspicious ?? 0;
      if (malicious >= 3) return { hit: true, critical: malicious >= 5 };
      if (malicious >= 1 || suspicious >= 2) return { hit: true, critical: false };
    } catch { continue; }
  }
  return { hit: false, critical: false };
}

// ─── PhishTank ────────────────────────────────────────────────────────────────

async function checkPhishTank(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;
  for (const url of urls) {
    try {
      const formData = new URLSearchParams();
      formData.append("url", url);
      formData.append("format", "json");
      const res = await fetch("https://checkurl.phishtank.com/checkurl/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "svindelsjekk/1.0" },
        body: formData.toString(),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.results?.in_database && data?.results?.valid) return true;
    } catch { continue; }
  }
  return false;
}

// ─── ThreatFox (abuse.ch) ─────────────────────────────────────────────────────

async function checkThreatFox(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;
  for (const url of urls) {
    try {
      const domain = extractDomain(url);
      if (!domain) continue;
      const res = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "search_ioc", search_term: domain }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.query_status === "ok" && data?.data && data.data.length > 0) return true;
    } catch { continue; }
  }
  return false;
}

// ─── WHOIS age check ──────────────────────────────────────────────────────────

async function checkWhoisAge(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;
  for (const url of urls) {
    try {
      const domain = extractDomain(url);
      if (!domain) continue;
      const res = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=at_free&domainName=${domain}&outputFormat=JSON`);
      if (!res.ok) continue;
      const data = await res.json();
      const created = data?.WhoisRecord?.createdDate || data?.WhoisRecord?.registryData?.createdDate;
      if (!created) continue;
      const createdDate = new Date(created);
      const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) return true; // Domain younger than 30 days = very suspicious
    } catch { continue; }
  }
  return false;
}

// ─── Cloudflare Radar ─────────────────────────────────────────────────────────

async function checkCloudflareRadar(urls: string[]): Promise<boolean> {
  const apiKey = process.env.CLOUDFLARE_RADAR_API_KEY;
  if (!apiKey || urls.length === 0) return false;
  for (const url of urls) {
    try {
      const encoded = encodeURIComponent(url);
      const res = await fetch(`https://api.cloudflare.com/client/v4/radar/url_scanner/scan`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, screenshotOptions: { fullPage: false } }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const verdicts = data?.result?.scan?.verdicts?.overall;
      if (verdicts?.malicious === true) return true;
    } catch { continue; }
  }
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const limit = rateLimit(ip);

    if (!limit.allowed) {
      const minutesLeft = Math.ceil(limit.resetIn / 60000);
      return NextResponse.json(
        { error: `For mange forespørsler. Prøv igjen om ${minutesLeft} minutter.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetIn / 1000)), "X-RateLimit-Remaining": "0" } }
      );
    }

    const { text, lang = "no" } = (await req.json()) as { text: string; lang: Lang };

    if (!text || text.trim().length < 3) return NextResponse.json({ error: "Teksten er for kort" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Teksten er for lang" }, { status: 400 });

    const urls = extractUrls(text);
    const hasUrls = urls.length > 0;

    // Run all checks in parallel
    const [
      googleHit,
      destroyResult,
      urlhausHit,
      virusTotalResult,
      phishTankHit,
      threatFoxHit,
      whoisYoung,
      cloudflareHit,
    ] = await Promise.all([
      checkGoogleSafeBrowsing(urls),
      checkDestroyTools(urls),
      checkURLhaus(urls),
      checkVirusTotal(urls),
      checkPhishTank(urls),
      checkThreatFox(urls),
      checkWhoisAge(urls),
      checkCloudflareRadar(urls),
    ]);

    const typosquat = checkTyposquatting(urls);

    // Pattern analysis
    const hasDangerKeyword = DANGER_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousKeyword = SUSPICIOUS_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousUrl = urls.some((u) => SUSPICIOUS_URL_PATTERNS.some((p) => p.test(u)));

    // Sources
    const sources: string[] = [];
    if (googleHit) sources.push("Google Safe Browsing");
    if (destroyResult.hit) sources.push("destroy.tools");
    if (urlhausHit) sources.push("URLhaus");
    if (virusTotalResult.hit) sources.push("VirusTotal");
    if (phishTankHit) sources.push("PhishTank");
    if (threatFoxHit) sources.push("ThreatFox");
    if (whoisYoung) sources.push("WHOIS (ny domene)");
    if (cloudflareHit) sources.push("Cloudflare Radar");
    if (typosquat.hit) sources.push(`Typosquatting (ligner ${typosquat.matchedDomain})`);
    if (hasDangerKeyword) sources.push("nøkkelord-analyse");
    if (hasSuspiciousUrl) sources.push("mistenkelig URL-mønster");

    // All checked databases
    const checkedDatabases = [
      { name: "Google Safe Browsing", found: googleHit, description: hasUrls ? "Googles database med millioner av kjente svindelnettsteder" : "Ingen lenker å sjekke" },
      { name: "destroy.tools", found: destroyResult.hit, description: hasUrls ? "Spesialisert database for phishing og svindeldomener" : "Ingen lenker å sjekke" },
      { name: "URLhaus (abuse.ch)", found: urlhausHit, description: hasUrls ? "Community-drevet database for skadelig programvare" : "Ingen lenker å sjekke" },
      { name: "VirusTotal", found: virusTotalResult.hit, description: hasUrls ? "70+ antivirusmotorer analyserer lenken" : "Ingen lenker å sjekke" },
      { name: "PhishTank", found: phishTankHit, description: hasUrls ? "Crowdsourcet phishing-database fra OpenDNS" : "Ingen lenker å sjekke" },
      { name: "ThreatFox (abuse.ch)", found: threatFoxHit, description: hasUrls ? "Database for malware og botnett-indikatorer" : "Ingen lenker å sjekke" },
      { name: "WHOIS domenealder", found: whoisYoung, description: hasUrls ? "Sjekker om domenet ble registrert for mindre enn 30 dager siden" : "Ingen lenker å sjekke" },
      { name: "Cloudflare Radar", found: cloudflareHit, description: hasUrls ? "Cloudflares sanntidsanalyse av nettsideinnhold" : "Ingen lenker å sjekke" },
      { name: "Typosquatting-detektor", found: typosquat.hit, description: hasUrls ? `Sjekker om lenken ligner offisielle norske domener${typosquat.hit ? ` (ligner ${typosquat.matchedDomain})` : ""}` : "Ingen lenker å sjekke" },
      { name: "Nøkkelord-analyse", found: hasDangerKeyword || hasSuspiciousKeyword, description: "Sjekker etter typiske svindelord på norsk" },
      { name: "URL-mønster", found: hasSuspiciousUrl, description: "Oppdager forkortede lenker og mistenkelige domeneendelser" },
    ];

    // Verdict
    let verdict: Verdict;
    if (googleHit || destroyResult.critical || hasDangerKeyword || urlhausHit || virusTotalResult.critical || phishTankHit || cloudflareHit || typosquat.hit) {
      verdict = "FARLIG";
    } else if (destroyResult.hit || hasSuspiciousKeyword || hasSuspiciousUrl || virusTotalResult.hit || threatFoxHit || whoisYoung) {
      verdict = "MISTENKELIG";
    } else {
      verdict = "TRYGG";
    }

    const result: CheckResult = {
      verdict,
      emoji: verdict === "FARLIG" ? "🚨" : verdict === "MISTENKELIG" ? "⚠️" : "✅",
      ...RESPONSES[verdict],
      sources,
      checkedDatabases,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Check API feil:", err);
    return NextResponse.json({ error: "Analyse mislyktes" }, { status: 500 });
  }
}