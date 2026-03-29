import { NextRequest, NextResponse } from "next/server";
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
  checkedDatabases: { name: string; found: boolean; description: string; category: string }[];
  // Scoring
  riskScore: number;          // 0-100
  scoreBreakdown: {
    tiFeeds: number;          // Threat Intelligence feeds (0-40)
    heuristics: number;       // Pattern/keyword analysis (0-30)
    reputation: number;       // IP/domain reputation (0-20)
    localSignals: number;     // Norwegian-specific (0-10)
  };
  // MITRE ATT&CK
  mitreTechniques: { id: string; name: string; tactic: string }[];
  // Context
  hasUrls: boolean;
  urlCount: number;
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
  // Credentials & banking
  /bankid/i, /passord/i, /kredittkort/i, /personnummer/i, /kontonummer/i,
  /bank.?konto/i, /verifiser.{0,20}konto/i, /konto.{0,20}sperr/i,
  /din konto er/i, /kortnum.{0,10}mer/i, /cvv/i, /pinkode/i,
  /sikkerhetskode/i, /engangskode/i, /betalingskort/i,
  // Winning / prizes
  /du har vunnet/i, /du er valgt/i, /du er trukket/i, /premie/i,
  /gratis iphone/i, /gratis gave/i, /gavekort/i,
  // Urgency / threats
  /klikk her umiddelbart/i, /logg inn n[åa]/i, /bekreft.{0,20}identitet/i,
  /utløper.{0,20}i dag/i, /mistet.{0,20}tilgang/i, /kontoen din vil bli slettet/i,
  /siste sjanse/i, /innen 24 timer/i, /innen 48 timer/i,
  /kontoen er sperret/i, /kontoen din er sperret/i, /sperret av sikkerhetsgrunner/i,
  // Impersonation
  /fra nav/i, /fra skatteetaten/i, /fra politiet/i, /fra dnb/i,
  /fra vipps/i, /fra posten/i, /fra telenor/i, /fra telia/i,
  // Payment requests
  /betal.{0,20}gebyr/i, /toll.{0,20}avgift/i, /frigjøre.{0,20}pakke/i,
  /utestående beløp/i, /ubetalt faktura/i, /inkasso/i,
  // Gift card scams
  /kjøp.{0,20}gavekort/i, /send.{0,20}gavekort/i, /itunes/i, /google play.{0,10}kort/i,
];

const SUSPICIOUS_PATTERNS = [
  /klikk her/i, /trykk her/i, /haster/i, /gratis/i, /bekreft/i,
  /levering.{0,20}pakke/i, /toll.{0,10}avgift/i, /send oss/i,
  /svar umiddelbart/i, /begrenset tid/i, /ikke ignorer/i,
  /oppdater.{0,20}informasjon/i, /verifiser.{0,20}deg/i,
  /vi trenger.{0,20}bekreftelse/i, /mistenkelig aktivitet/i,
  /uvanlig.{0,20}aktivitet/i, /logger deg ut/i, /midlertidig sperret/i,
  /følg lenken/i, /klikk på lenken/i, /åpne lenken/i,
];

const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/i, /tinyurl/i, /shorturl/i, /ow\.ly/i, /rb\.gy/i, /cutt\.ly/i,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /[a-z0-9-]+\.(xyz|top|click|loan|win|gq|ml|cf|tk|pw|work|racing|party|review|trade|download|men)\b/i,
  /dnb-/i, /vipps-/i, /sparebank-/i, /nav-/i, /posten-/i,
];

// ─── Phone number analysis ───────────────────────────────────────────────────

// Norwegian scam phone patterns
const SUSPICIOUS_PHONE_PATTERNS = [
  // Foreign numbers pretending to be Norwegian services
  /\+(?!47)\d{10,15}/,           // Non-Norwegian international numbers
  /00(?!47)\d{10,14}/,           // Non-Norwegian international format
  // Suspicious Norwegian patterns
  /90\d{6}/,                 // 90x numbers (often used in spam)
];

const PREMIUM_RATE_PATTERNS = [
  /82\d{6}/,   // Premium rate 82x
  /83\d{6}/,   // Premium rate 83x
  /84\d{6}/,   // Premium rate 84x
  /85\d{6}/,   // Premium rate 85x
  /820\d{5}/,  // Premium rate
];

interface PhoneAnalysis {
  hasSuspiciousPhone: boolean;
  hasPremiumRate: boolean;
  extractedNumbers: string[];
}

function analyzePhoneNumbers(text: string): PhoneAnalysis {
  const phoneRegex = /(?:\+47|0047|47)?[\s-]?(?:\d[\s-]?){8}/g;
  const allNumbers = text.match(phoneRegex) || [];
  const cleanNumbers = allNumbers.map(n => n.replace(/[\s-]/g, ""));

  const hasSuspiciousPhone = SUSPICIOUS_PHONE_PATTERNS.some(p => p.test(text));
  const hasPremiumRate = PREMIUM_RATE_PATTERNS.some(p => p.test(text));

  return { hasSuspiciousPhone, hasPremiumRate, extractedNumbers: cleanNumbers.slice(0, 3) };
}

// ─── Sender analysis ──────────────────────────────────────────────────────────

interface SenderAnalysis {
  isSuspiciousSender: boolean;
  reason: string;
}

function analyzeSender(text: string): SenderAnalysis {
  // Check for sender spoofing patterns in SMS
  const spoofedSenders = [
    { pattern: /^fra:?\s*(nav|skatteetaten|politiet|dnb|vipps|posten|telenor|telia|sparebank)/im, reason: "Avsender utgir seg for å være en offentlig instans" },
    { pattern: /avsender.{0,20}(nav|skatteetaten|politiet|dnb|vipps)/im, reason: "Falsk avsender" },
    { pattern: /melding fra.{0,30}(nav|skatteetaten|politiet|bank)/im, reason: "Utgir seg for å være offentlig instans" },
  ];

  for (const { pattern, reason } of spoofedSenders) {
    if (pattern.test(text)) return { isSuspiciousSender: true, reason };
  }

  return { isSuspiciousSender: false, reason: "" };
}

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


// ─── Homoglyph detector ───────────────────────────────────────────────────────

// Maps lookalike characters to their ASCII equivalents
const HOMOGLYPH_MAP: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "ι": "i", "ο": "o", "ρ": "p", "ν": "v", "μ": "m", "ω": "w",
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b",
  "ḷ": "l", "ẹ": "e", "ạ": "a", "ọ": "o", "ụ": "u",
  "vv": "w", "rn": "m",
};

function normalizeHomoglyphs(str: string): string {
  let result = str;
  for (const [glyph, ascii] of Object.entries(HOMOGLYPH_MAP)) {
    result = result.split(glyph).join(ascii);
  }
  return result;
}

function checkHomoglyphs(urls: string[]): { hit: boolean; original: string; normalized: string } {
  const TRUSTED_BRANDS = [
    "paypal", "netflix", "apple", "microsoft", "amazon", "google",
    "facebook", "instagram", "dnb", "vipps", "nav", "skatteetaten",
    "sparebank", "nordea", "telenor", "telia", "posten", "bankid",
  ];

  for (const url of urls) {
    const domain = extractDomain(url).toLowerCase();
    if (!domain) continue;
    const normalized = normalizeHomoglyphs(domain);

    if (normalized !== domain) {
      for (const brand of TRUSTED_BRANDS) {
        if (normalized.includes(brand) && !domain.includes(brand)) {
          return { hit: true, original: domain, normalized };
        }
      }
    }
  }
  return { hit: false, original: "", normalized: "" };
}

// ─── SSL checker ──────────────────────────────────────────────────────────────

async function checkSSL(urls: string[]): Promise<{ hit: boolean; reason: string }> {
  for (const url of urls) {
    try {
      // Check if URL uses HTTP (no SSL at all)
      if (url.startsWith("http://")) {
        return { hit: true, reason: "Ingen SSL/HTTPS — usikker tilkobling" };
      }

      // Try to fetch with HTTPS and check for certificate errors
      const domain = extractDomain(url);
      if (!domain) continue;

      const res = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });

      // If we get here, SSL is valid
      // SSL valid
    } catch (err) {
      const msg = String(err).toLowerCase();
      if (msg.includes("cert") || msg.includes("ssl") || msg.includes("tls") || msg.includes("certificate")) {
        return { hit: true, reason: "Ugyldig eller utløpt SSL-sertifikat" };
      }
    }
  }
  return { hit: false, reason: "" };
}

// ─── Brreg.no (Norwegian company registry) ────────────────────────────────────

async function checkBrreg(text: string): Promise<{ hit: boolean; reason: string }> {
  // Extract org numbers (9 digits, common in Norwegian scam messages)
  const orgNrMatch = text.match(/(\d{9})/);
  if (!orgNrMatch) return { hit: false, reason: "" };

  const orgNr = orgNrMatch[1];
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNr}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (res.status === 404) {
      return { hit: true, reason: `Org.nr. ${orgNr} finnes ikke i Brønnøysundregistrene` };
    }

    if (res.ok) {
      const data = await res.json();
      // Check if company is under liquidation or bankruptcy
      if (data?.underAvvikling || data?.underTvangsavviklingEllerTvangsopplosning || data?.konkurs) {
        return { hit: true, reason: `Selskapet (${data.navn}) er under avvikling eller konkurs` };
      }
    }
  } catch { /* ignore */ }

  return { hit: false, reason: "" };
}

// ─── Shodan InternetDB ────────────────────────────────────────────────────────

async function checkShodan(urls: string[]): Promise<{ hit: boolean; reason: string }> {
  for (const url of urls) {
    try {
      const domain = extractDomain(url);
      if (!domain) continue;

      // Resolve domain to IP first
      const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
      if (!dnsRes.ok) continue;
      const dnsData = await dnsRes.json();
      const ip = dnsData?.Answer?.[0]?.data;
      if (!ip) continue;

      // Check IP against Shodan InternetDB (no API key needed)
      const shodanRes = await fetch(`https://internetdb.shodan.io/${ip}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!shodanRes.ok) continue;
      const shodanData = await shodanRes.json();

      // Check for known vulns or tags
      if (shodanData?.vulns && shodanData.vulns.length > 0) {
        return { hit: true, reason: `IP ${ip} har kjente sikkerhetssårbarheter (${shodanData.vulns.slice(0, 2).join(", ")})` };
      }
      if (shodanData?.tags && (shodanData.tags.includes("malware") || shodanData.tags.includes("self-signed"))) {
        return { hit: true, reason: `IP ${ip} er flagget som mistenkelig av Shodan` };
      }
    } catch { continue; }
  }
  return { hit: false, reason: "" };
}


// ─── AbuseIPDB ────────────────────────────────────────────────────────────────

async function checkAbuseIPDB(urls: string[]): Promise<{ hit: boolean; score: number }> {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey || urls.length === 0) return { hit: false, score: 0 };

  for (const url of urls) {
    try {
      const domain = extractDomain(url);
      if (!domain) continue;

      // Resolve to IP first via Google DNS
      const dnsRes = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!dnsRes.ok) continue;
      const dnsData = await dnsRes.json();
      const ip = dnsData?.Answer?.[0]?.data;
      if (!ip || ip.startsWith("192.") || ip.startsWith("10.") || ip.startsWith("127.")) continue;

      const res = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
        {
          headers: { Key: apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const score = data?.data?.abuseConfidenceScore ?? 0;
      if (score >= 25) return { hit: true, score };
    } catch { continue; }
  }
  return { hit: false, score: 0 };
}

// ─── Redirect chain analyzer ──────────────────────────────────────────────────

interface RedirectResult {
  hit: boolean;
  chain: string[];
  reason: string;
}

async function checkRedirectChain(urls: string[]): Promise<RedirectResult> {
  if (urls.length === 0) return { hit: false, chain: [], reason: "" };

  for (const startUrl of urls) {
    try {
      const chain: string[] = [startUrl];
      let current = startUrl;

      for (let i = 0; i < 8; i++) {
        const res = await fetch(current, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(4000),
        });

        const location = res.headers.get("location");
        if (!location || res.status < 300 || res.status >= 400) break;

        const next = location.startsWith("http") ? location : new URL(location, current).href;
        chain.push(next);
        current = next;

        // Check if redirect goes to suspicious domain
        const nextDomain = extractDomain(next);
        if (SUSPICIOUS_URL_PATTERNS.some(p => p.test(nextDomain))) {
          return { hit: true, chain, reason: `Omdirigerer til mistenkelig domene: ${nextDomain}` };
        }
      }

      // Long redirect chains are suspicious
      if (chain.length >= 4) {
        return { hit: true, chain, reason: `Lang omdirigeringskjede (${chain.length} steg)` };
      }

      // Check if final destination differs significantly from start
      if (chain.length > 1) {
        const startDomain = extractDomain(startUrl);
        const endDomain = extractDomain(chain[chain.length - 1]);
        if (startDomain !== endDomain) {
          // Check if end domain is suspicious
          const isEndSuspicious = SUSPICIOUS_URL_PATTERNS.some(p => p.test(endDomain));
          if (isEndSuspicious) {
            return { hit: true, chain, reason: `Skjult destinasjon: ${endDomain}` };
          }
        }
      }
    } catch { continue; }
  }
  return { hit: false, chain: [], reason: "" };
}

// ─── Email header analyzer (SPF/DKIM/DMARC) ──────────────────────────────────

interface EmailHeaderResult {
  hit: boolean;
  issues: string[];
}

function analyzeEmailHeaders(text: string): EmailHeaderResult {
  const issues: string[] = [];

  // Check for pasted email headers
  const hasHeaders = /^(from|to|subject|date|message-id|received|mime-version|content-type):/im.test(text);
  if (!hasHeaders) return { hit: false, issues: [] };

  // SPF check
  const spfHeader = text.match(/received-spf:\s*(\w+)/i)?.[1]?.toLowerCase();
  if (spfHeader === "fail" || spfHeader === "softfail") {
    issues.push(`SPF ${spfHeader.toUpperCase()}: Avsenderen er ikke autorisert`);
  }

  // DKIM check
  const dkimResult = text.match(/dkim=(\w+)/i)?.[1]?.toLowerCase();
  if (dkimResult === "fail" || dkimResult === "none") {
    issues.push("DKIM-signatur mangler eller er ugyldig");
  }

  // DMARC check
  const dmarcResult = text.match(/dmarc=(\w+)/i)?.[1]?.toLowerCase();
  if (dmarcResult === "fail" || dmarcResult === "none") {
    issues.push("DMARC-validering feilet");
  }

  // Check for mismatched From vs Reply-To
  const fromMatch = text.match(/^from:.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/im)?.[1]?.toLowerCase();
  const replyToMatch = text.match(/^reply-to:.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/im)?.[1]?.toLowerCase();
  if (fromMatch && replyToMatch && fromMatch !== replyToMatch) {
    const fromDomain = fromMatch.split("@")[1];
    const replyDomain = replyToMatch.split("@")[1];
    if (fromDomain !== replyDomain) {
      issues.push(`Mistenkelig: From (${fromDomain}) og Reply-To (${replyDomain}) er forskjellige domener`);
    }
  }

  // Check for suspicious sending IPs in Received headers
  const receivedHeaders = text.match(/received: from .+/gi) || [];
  for (const header of receivedHeaders) {
    if (SUSPICIOUS_PHONE_PATTERNS.some(p => p.test(header))) {
      issues.push("Mistenkelig avsender-IP i e-posthoder");
      break;
    }
  }

  return { hit: issues.length > 0, issues };
}


// ─── MITRE ATT&CK mapping ─────────────────────────────────────────────────────

const MITRE_TECHNIQUES = {
  phishing:           { id: "T1566",   name: "Phishing",                    tactic: "Initial Access" },
  spearphishing:      { id: "T1566.001", name: "Spearphishing Attachment",  tactic: "Initial Access" },
  domainImpersonation:{ id: "T1583.001", name: "Domains",                   tactic: "Resource Development" },
  homoglyph:          { id: "T1036.008", name: "Masquerading — Homoglyph",  tactic: "Defense Evasion" },
  urlRedirect:        { id: "T1608.005", name: "Link Target",               tactic: "Resource Development" },
  credentialPhishing: { id: "T1056.003", name: "Web Portal Capture",        tactic: "Collection" },
  smishing:           { id: "T1660",    name: "Phishing via SMS",           tactic: "Initial Access" },
  impersBrand:        { id: "T1598.003", name: "Spearphishing via Service", tactic: "Reconnaissance" },
};

function getMitreTechniques(signals: {
  hasPhishingUrl: boolean;
  hasDangerKeyword: boolean;
  hasHomoglyph: boolean;
  hasRedirect: boolean;
  hasCredentialRequest: boolean;
  hasSmsPattern: boolean;
  hasImpersonation: boolean;
}): { id: string; name: string; tactic: string }[] {
  const techniques: { id: string; name: string; tactic: string }[] = [];
  if (signals.hasPhishingUrl || signals.hasDangerKeyword) techniques.push(MITRE_TECHNIQUES.phishing);
  if (signals.hasHomoglyph) techniques.push(MITRE_TECHNIQUES.homoglyph);
  if (signals.hasRedirect) techniques.push(MITRE_TECHNIQUES.urlRedirect);
  if (signals.hasCredentialRequest) techniques.push(MITRE_TECHNIQUES.credentialPhishing);
  if (signals.hasSmsPattern) techniques.push(MITRE_TECHNIQUES.smishing);
  if (signals.hasImpersonation) techniques.push(MITRE_TECHNIQUES.impersBrand);
  return [...new Map(techniques.map(t => [t.id, t])).values()];
}

// ─── Risk scoring engine ──────────────────────────────────────────────────────

interface ScoreBreakdown {
  tiFeeds: number;
  heuristics: number;
  reputation: number;
  localSignals: number;
}

function calculateRiskScore(hits: {
  // TI feeds (max 40)
  googleHit: boolean;
  urlhausHit: boolean;
  phishTankHit: boolean;
  destroyHit: boolean;
  destroyCritical: boolean;
  threatFoxHit: boolean;
  virusTotalHit: boolean;
  virusTotalCritical: boolean;
  cloudflareHit: boolean;
  // Heuristics (max 30)
  hasDangerKeyword: boolean;
  hasSuspiciousKeyword: boolean;
  hasSuspiciousUrl: boolean;
  hasHomoglyph: boolean;
  hasSslIssue: boolean;
  hasRedirect: boolean;
  hasEmailIssue: boolean;
  whoisYoung: boolean;
  // Reputation (max 20)
  abuseIPHit: boolean;
  abuseIPScore: number;
  shodanHit: boolean;
  // Norwegian local signals (max 10)
  hasPremiumPhone: boolean;
  hasSuspiciousPhone: boolean;
  hasFakeSender: boolean;
  brregHit: boolean;
  hasTyposquatting: boolean;
}): { total: number; breakdown: ScoreBreakdown } {

  // TI feeds — max 40
  let tiFeeds = 0;
  if (hits.googleHit)          tiFeeds += 15;
  if (hits.urlhausHit)         tiFeeds += 12;
  if (hits.phishTankHit)       tiFeeds += 12;
  if (hits.cloudflareHit)      tiFeeds += 10;
  if (hits.destroyCritical)    tiFeeds += 10;
  else if (hits.destroyHit)    tiFeeds += 6;
  if (hits.virusTotalCritical) tiFeeds += 10;
  else if (hits.virusTotalHit) tiFeeds += 6;
  if (hits.threatFoxHit)       tiFeeds += 8;
  tiFeeds = Math.min(40, tiFeeds);

  // Heuristics — max 30
  let heuristics = 0;
  if (hits.hasDangerKeyword)   heuristics += 12;
  if (hits.hasHomoglyph)       heuristics += 10;
  if (hits.hasEmailIssue)      heuristics += 8;
  if (hits.hasRedirect)        heuristics += 6;
  if (hits.hasSuspiciousKeyword) heuristics += 5;
  if (hits.hasSuspiciousUrl)   heuristics += 5;
  if (hits.hasSslIssue)        heuristics += 4;
  if (hits.whoisYoung)         heuristics += 4;
  heuristics = Math.min(30, heuristics);

  // Reputation — max 20
  let reputation = 0;
  if (hits.abuseIPHit) reputation += Math.min(15, Math.round(hits.abuseIPScore / 10));
  if (hits.shodanHit)  reputation += 8;
  reputation = Math.min(20, reputation);

  // Norwegian local signals — max 10
  let localSignals = 0;
  if (hits.hasPremiumPhone)    localSignals += 5;
  if (hits.hasFakeSender)      localSignals += 4;
  if (hits.brregHit)           localSignals += 4;
  if (hits.hasTyposquatting)   localSignals += 4;
  if (hits.hasSuspiciousPhone) localSignals += 2;
  localSignals = Math.min(10, localSignals);

  const total = Math.min(100, tiFeeds + heuristics + reputation + localSignals);

  return { total, breakdown: { tiFeeds, heuristics, reputation, localSignals } };
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
      sslResult,
      brregResult,
      shodanResult,
      abuseIPResult,
      redirectResult,
    ] = await Promise.all([
      checkGoogleSafeBrowsing(urls),
      checkDestroyTools(urls),
      checkURLhaus(urls),
      checkVirusTotal(urls),
      checkPhishTank(urls),
      checkThreatFox(urls),
      checkWhoisAge(urls),
      checkCloudflareRadar(urls),
      checkSSL(urls),
      checkBrreg(text),
      checkShodan(urls),
      checkAbuseIPDB(urls),
      checkRedirectChain(urls),
    ]);

    const typosquat = checkTyposquatting(urls);
    const homoglyphResult = checkHomoglyphs(urls);
    const emailHeaderResult = analyzeEmailHeaders(text);

    // Pattern analysis
    const hasDangerKeyword = DANGER_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousKeyword = SUSPICIOUS_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousUrl = urls.some((u) => SUSPICIOUS_URL_PATTERNS.some((p) => p.test(u)));

    // Phone & sender analysis
    const phoneAnalysis = analyzePhoneNumbers(text);
    const senderAnalysis = analyzeSender(text);

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
    if (phoneAnalysis.hasPremiumRate) sources.push("premium-rate nummer");
    if (phoneAnalysis.hasSuspiciousPhone) sources.push("mistenkelig telefonnummer");
    if (senderAnalysis.isSuspiciousSender) sources.push("falsk avsender");
    if (homoglyphResult.hit) sources.push("homoglyph-angrep");
    if (sslResult.hit) sources.push("SSL-problem");
    if (brregResult.hit) sources.push("Brreg.no");
    if (shodanResult.hit) sources.push("Shodan InternetDB");
    if (abuseIPResult.hit) sources.push(`AbuseIPDB (score: ${abuseIPResult.score}%)`);
    if (redirectResult.hit) sources.push("Redirect chain");
    if (emailHeaderResult.hit) sources.push("E-posthoder (SPF/DKIM/DMARC)");

    // All checked databases
    const checkedDatabases = [
      { name: "Google Safe Browsing", found: googleHit, category: "TI Feed", description: hasUrls ? "Googles database med millioner av kjente svindelnettsteder" : "Ingen lenker å sjekke" },
      { name: "destroy.tools", found: destroyResult.hit, category: "TI Feed", description: hasUrls ? "Spesialisert database for phishing og svindeldomener" : "Ingen lenker å sjekke" },
      { name: "URLhaus (abuse.ch)", found: urlhausHit, category: "TI Feed", description: hasUrls ? "Community-drevet database for skadelig programvare" : "Ingen lenker å sjekke" },
      { name: "VirusTotal", found: virusTotalResult.hit, category: "TI Feed", description: hasUrls ? "70+ antivirusmotorer analyserer lenken" : "Ingen lenker å sjekke" },
      { name: "PhishTank", found: phishTankHit, category: "TI Feed", description: hasUrls ? "Crowdsourcet phishing-database fra OpenDNS" : "Ingen lenker å sjekke" },
      { name: "ThreatFox (abuse.ch)", found: threatFoxHit, category: "TI Feed", description: hasUrls ? "Database for malware og botnett-indikatorer" : "Ingen lenker å sjekke" },
      { name: "WHOIS domenealder", found: whoisYoung, category: "Heuristikk", description: hasUrls ? "Sjekker om domenet ble registrert for mindre enn 30 dager siden" : "Ingen lenker å sjekke" },
      { name: "Cloudflare Radar", found: cloudflareHit, category: "TI Feed", description: hasUrls ? "Cloudflares sanntidsanalyse av nettsideinnhold" : "Ingen lenker å sjekke" },
      { name: "Typosquatting-detektor", found: typosquat.hit, category: "Heuristikk", description: hasUrls ? `Sjekker om lenken ligner offisielle norske domener${typosquat.hit ? ` (ligner ${typosquat.matchedDomain})` : ""}` : "Ingen lenker å sjekke" },
      { name: "Nøkkelord-analyse", found: hasDangerKeyword || hasSuspiciousKeyword, category: "Heuristikk", description: "Sjekker etter 40+ typiske svindelord og -uttrykk på norsk" },
      { name: "Telefonnummer-analyse", found: phoneAnalysis.hasPremiumRate || phoneAnalysis.hasSuspiciousPhone, category: "Norsk", description: "Oppdager premium-rate numre og mistenkelige utenlandske numre" },
      { name: "Avsender-analyse", found: senderAnalysis.isSuspiciousSender, category: "Norsk", description: senderAnalysis.isSuspiciousSender ? senderAnalysis.reason : "Sjekker om avsenderen utgir seg for å være en offentlig instans" },
      { name: "URL-mønster", found: hasSuspiciousUrl, category: "Heuristikk", description: "Oppdager forkortede lenker og mistenkelige domeneendelser" },
      { name: "Homoglyph-detektor", found: homoglyphResult.hit, category: "Heuristikk", description: hasUrls ? `Oppdager lookalike-tegn (paypa1.com istedenfor paypal.com)${homoglyphResult.hit ? ": " + homoglyphResult.original : ""}` : "Ingen lenker å sjekke" },
      { name: "SSL-sjekker", found: sslResult.hit, category: "Heuristikk", description: hasUrls ? (sslResult.reason || "Sjekker SSL-sertifikat og HTTPS") : "Ingen lenker å sjekke" },
      { name: "Brreg.no register", found: brregResult.hit, category: "Norsk", description: brregResult.reason || "Sjekker org.nr. mot Brønnøysundregistrene" },
      { name: "Shodan InternetDB", found: shodanResult.hit, category: "Omdømme", description: hasUrls ? (shodanResult.reason || "Sjekker IP for kjente sårbarheter") : "Ingen lenker å sjekke" },
      { name: "AbuseIPDB", found: abuseIPResult.hit, category: "Omdømme", description: hasUrls ? (abuseIPResult.hit ? `IP har ${abuseIPResult.score}% misbruksscore` : "Sjekker IP mot misbruks-database") : "Ingen lenker å sjekke" },
      { name: "Redirect chain", found: redirectResult.hit, category: "Heuristikk", description: hasUrls ? (redirectResult.reason || "Sporer URL-omdirigeringer til skjult destinasjon") : "Ingen lenker å sjekke" },
      { name: "E-posthoder (SPF/DKIM/DMARC)", found: emailHeaderResult.hit, category: "Heuristikk", description: emailHeaderResult.hit ? emailHeaderResult.issues[0] : "Lim inn e-posthoder for autentisitetssjekk" },
    ];

    // ─── Risk scoring ────────────────────────────────────────────────────────────
    const { total: riskScore, breakdown: scoreBreakdown } = calculateRiskScore({
      googleHit, urlhausHit, phishTankHit,
      destroyHit: destroyResult.hit, destroyCritical: destroyResult.critical,
      threatFoxHit, virusTotalHit: virusTotalResult.hit, virusTotalCritical: virusTotalResult.critical,
      cloudflareHit,
      hasDangerKeyword, hasSuspiciousKeyword, hasSuspiciousUrl,
      hasHomoglyph: homoglyphResult.hit, hasSslIssue: sslResult.hit,
      hasRedirect: redirectResult.hit, hasEmailIssue: emailHeaderResult.hit,
      whoisYoung,
      abuseIPHit: abuseIPResult.hit, abuseIPScore: abuseIPResult.score,
      shodanHit: shodanResult.hit,
      hasPremiumPhone: phoneAnalysis.hasPremiumRate, hasSuspiciousPhone: phoneAnalysis.hasSuspiciousPhone,
      hasFakeSender: senderAnalysis.isSuspiciousSender, brregHit: brregResult.hit,
      hasTyposquatting: typosquat.hit,
    });

    // ─── MITRE ATT&CK ────────────────────────────────────────────────────────────
    const mitreTechniques = getMitreTechniques({
      hasPhishingUrl: googleHit || phishTankHit || urlhausHit,
      hasDangerKeyword,
      hasHomoglyph: homoglyphResult.hit,
      hasRedirect: redirectResult.hit,
      hasCredentialRequest: /passord|bankid|personnummer|kontonummer|engangskode/i.test(text),
      hasSmsPattern: phoneAnalysis.hasPremiumRate || phoneAnalysis.hasSuspiciousPhone,
      hasImpersonation: senderAnalysis.isSuspiciousSender || typosquat.hit,
    });

    // ─── Verdict (score-based) ───────────────────────────────────────────────────
    let verdict: Verdict;
    if (riskScore >= 40) {
      verdict = "FARLIG";
    } else if (riskScore >= 15) {
      verdict = "MISTENKELIG";
    } else {
      verdict = "TRYGG";
    }

    // ─── UX: better descriptions when no URLs ────────────────────────────────────
    const dbWithContext = checkedDatabases.map(db => ({
      ...db,
      description: (!hasUrls && db.description === "Ingen lenker å sjekke")
        ? "Kun aktiv ved URL-analyse — lim inn en lenke for full sjekk"
        : db.description,
    }));

    const result: CheckResult = {
      verdict,
      emoji: verdict === "FARLIG" ? "🚨" : verdict === "MISTENKELIG" ? "⚠️" : "✅",
      ...RESPONSES[verdict],
      sources,
      checkedDatabases: dbWithContext,
      riskScore,
      scoreBreakdown,
      mitreTechniques,
      hasUrls,
      urlCount: urls.length,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Check API feil:", err);
    return NextResponse.json({ error: "Analyse mislyktes" }, { status: 500 });
  }
}