import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "no" | "pl" | "en";
type Verdict = "FARLIG" | "MISTENKELIG" | "TRYGG";

interface CheckResult {
  verdict: Verdict;
  emoji: "🚨" | "⚠️" | "✅";
  title: string;
  explanation: string;
  tips: string[];
  sources: string[];
}

// ─── Keyword patterns ────────────────────────────────────────────────────────

const DANGER_PATTERNS = [
  /bankid/i,
  /passord/i,
  /password/i,
  /hasło/i,
  /kredittkort/i,
  /credit.?card/i,
  /personnummer/i,
  /kontonummer/i,
  /bank.?konto/i,
  /verifiser.{0,20}konto/i,
  /verify.{0,20}account/i,
  /suspended.{0,20}account/i,
  /konto.{0,20}sperr/i,
  /din konto er/i,
  /your account has been/i,
  /utl.pet/i,
  /du har vunnet/i,
  /you have won/i,
  /wygrał/i,
  /klikk her umiddelbart/i,
  /click here immediately/i,
  /kliknij teraz/i,
  /logg inn n[åa]/i,
];

const SUSPICIOUS_PATTERNS = [
  /klikk her/i,
  /click here/i,
  /kliknij/i,
  /haster/i,
  /urgent/i,
  /pilne/i,
  /gratis/i,
  /free prize/i,
  /darmow/i,
  /bekreft/i,
  /confirm your/i,
  /potwierdź/i,
  /levering.{0,20}pakke/i,
  /package.{0,20}deliver/i,
  /paczka/i,
  /toll.{0,10}avgift/i,
  /customs fee/i,
  /opłata celna/i,
  /send oss/i,
  /send us your/i,
  /wyślij nam/i,
];

const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/i,
  /tinyurl/i,
  /t\.co(?!m)/i,
  /shorturl/i,
  /ow\.ly/i,
  /rb\.gy/i,
  /cutt\.ly/i,
  /rebrand\.ly/i,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /[a-z0-9-]+\.(xyz|top|click|loan|win|gq|ml|cf|tk|pw|work|racing|party|review|trade|cricket|science|webcam|date|download|men|accountant)\b/i,
];

// ─── i18n responses ───────────────────────────────────────────────────────────

const RESPONSES: Record<Lang, Record<Verdict, { title: string; explanation: string; tips: string[] }>> = {
  no: {
    FARLIG: {
      title: "Dette er sannsynligvis svindel!",
      explanation: "Meldingen inneholder tegn som er typiske for svindel i Norge. Ikke klikk på lenker og ikke del personlig informasjon.",
      tips: ["Ikke svar på meldingen", "Ikke klikk på noen lenker", "Kontakt banken din direkte hvis du er usikker"],
    },
    MISTENKELIG: {
      title: "Vær forsiktig – mistenkelig melding",
      explanation: "Noe i denne meldingen ser ikke helt riktig ut. Det kan være svindel. Vær forsiktig før du gjør noe.",
      tips: ["Ikke hast deg – ta deg tid til å tenke", "Ring den som angivelig sendte meldingen på et kjent nummer", "Spør en du stoler på"],
    },
    TRYGG: {
      title: "Ser trygt ut",
      explanation: "Vi fant ingen kjente svindeltegn i denne meldingen. Men vær alltid forsiktig med ukjente avsendere.",
      tips: ["Husk at ingen bank ber om passord på SMS", "Ved tvil, ring banken direkte"],
    },
  },
  pl: {
    FARLIG: {
      title: "To prawdopodobnie oszustwo!",
      explanation: "Wiadomość zawiera typowe oznaki oszustwa stosowanego w Norwegii. Nie klikaj żadnych linków i nie podawaj danych osobowych.",
      tips: ["Nie odpowiadaj na tę wiadomość", "Nie klikaj żadnych linków", "Skontaktuj się bezpośrednio z bankiem, jeśli masz wątpliwości"],
    },
    MISTENKELIG: {
      title: "Ostrożnie – podejrzana wiadomość",
      explanation: "Coś w tej wiadomości wygląda niepokojąco. Może to być oszustwo. Nie spiesz się z działaniem.",
      tips: ["Nie działaj pod wpływem pośpiechu", "Zadzwoń do nadawcy na znany numer", "Zapytaj kogoś, komu ufasz"],
    },
    TRYGG: {
      title: "Wygląda bezpiecznie",
      explanation: "Nie znaleźliśmy typowych oznak oszustwa. Jednak zawsze zachowaj ostrożność wobec nieznanych nadawców.",
      tips: ["Żaden bank nie prosi o hasło przez SMS", "W razie wątpliwości zadzwoń bezpośrednio do banku"],
    },
  },
  en: {
    FARLIG: {
      title: "This is likely a scam!",
      explanation: "This message contains typical scam signs used in Norway. Do not click any links or share personal information.",
      tips: ["Do not reply to this message", "Do not click any links", "Contact your bank directly if unsure"],
    },
    MISTENKELIG: {
      title: "Be careful – suspicious message",
      explanation: "Something in this message does not look right. It may be a scam. Take your time before doing anything.",
      tips: ["Don't rush – take time to think", "Call the sender on a number you already know", "Ask someone you trust"],
    },
    TRYGG: {
      title: "Looks safe",
      explanation: "We found no known scam signs in this message. But always be careful with unknown senders.",
      tips: ["No bank will ask for your password by SMS", "If in doubt, call your bank directly"],
    },
  },
};

// ─── URL extractor ────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  return text.match(urlRegex) || [];
}

// ─── Google Safe Browsing check ───────────────────────────────────────────────

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
          client: { clientId: "scam-checker-norway", clientVersion: "1.0.0" },
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

// ─── PhishDestroy check ───────────────────────────────────────────────────────

async function checkPhishDestroy(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;

  for (const url of urls) {
    try {
      const domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
      const res = await fetch(`https://phishdestroy.com/api/v2/check?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.risk_score > 70 || data?.severity === "high") return true;
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
      return NextResponse.json({ error: "Text too short" }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const urls = extractUrls(text);
    const sources: string[] = [];

    // 1. Check URLs against external APIs (parallel)
    const [googleHit, phishHit] = await Promise.all([
      checkGoogleSafeBrowsing(urls),
      checkPhishDestroy(urls),
    ]);

    if (googleHit) sources.push("Google Safe Browsing");
    if (phishHit) sources.push("PhishDestroy");

    // 2. Keyword analysis
    const hasDangerKeyword = DANGER_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousKeyword = SUSPICIOUS_PATTERNS.some((p) => p.test(text));
    const hasSuspiciousUrl = urls.some((u) => SUSPICIOUS_URL_PATTERNS.some((p) => p.test(u)));

    if (hasDangerKeyword) sources.push("keyword analysis");
    if (hasSuspiciousUrl) sources.push("suspicious URL pattern");

    // 3. Determine verdict
    let verdict: Verdict;
    if (googleHit || phishHit || hasDangerKeyword) {
      verdict = "FARLIG";
    } else if (hasSuspiciousKeyword || hasSuspiciousUrl) {
      verdict = "MISTENKELIG";
    } else {
      verdict = "TRYGG";
    }

    const safeLang: Lang = ["no", "pl", "en"].includes(lang) ? (lang as Lang) : "no";
    const response = RESPONSES[safeLang][verdict];

    const result: CheckResult = {
      verdict,
      emoji: verdict === "FARLIG" ? "🚨" : verdict === "MISTENKELIG" ? "⚠️" : "✅",
      ...response,
      sources,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Check API error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
