"use client";

import { useState } from "react";
import Link from "next/link";

type Verdict = "FARLIG" | "MISTENKELIG" | "TRYGG";

interface CheckResult {
  verdict: Verdict;
  emoji: string;
  title: string;
  explanation: string;
  tips: string[];
  sources: string[];
  checkedDatabases: { name: string; found: boolean; description: string }[];
}

const verdictStyle: Record<Verdict, { bg: string; border: string; titleColor: string; textColor: string; label: string }> = {
  FARLIG:      { bg: "bg-red-50",   border: "border-red-400",   titleColor: "text-red-800",   textColor: "text-red-700",   label: "SVINDEL" },
  MISTENKELIG: { bg: "bg-amber-50", border: "border-amber-400", titleColor: "text-amber-800", textColor: "text-amber-700", label: "MISTENKELIG" },
  TRYGG:       { bg: "bg-green-50", border: "border-green-400", titleColor: "text-green-800", textColor: "text-green-700", label: "TRYGG" },
};

const TIPS = [
  "Ingen bank ber om passord eller BankID via SMS",
  "Haster det veldig? Det er et tegn på svindel",
  "Sjekk om lenken ser litt «feil» ut (f.eks. «dnb-sikker.com»)",
  "Har du vunnet noe du ikke husker å ha deltatt på?",
  "Ring banken direkte på nummeret bak kortet ditt",
];

export default function SvindelSjekk() {
  const [mode, setMode] = useState<"sms" | "link">("sms");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [showDatabases, setShowDatabases] = useState(false);

  const handleCheck = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    setShowReport(false);
    setReportSent(false);
    setShowDatabases(false);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, lang: "no" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feil");
      setResult(data);
    } catch {
      setError("Noe gikk galt. Prøv igjen om litt.");
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, note: reportNote, verdict: result?.verdict, lang: "no" }),
    });
    setReportSent(true);
  };

  const style = result ? verdictStyle[result.verdict] : null;

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
              <path d="M32 4L8 14v18c0 14 11 26 24 28 13-2 24-14 24-28V14L32 4z" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2.5"/>
              <path d="M22 32l7 7 13-13" stroke="#1d4ed8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">SvindelSjekk</h1>
          <p className="text-xl text-blue-700">Er denne meldingen svindel?</p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-3 mb-5">
          {(["sms", "link"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setError(""); }}
              className={`flex-1 py-5 rounded-2xl border-2 text-center transition-all font-medium text-lg ${
                mode === m
                  ? "border-blue-700 bg-white text-blue-800 shadow-sm"
                  : "border-blue-200 bg-white/60 text-blue-400 hover:border-blue-300"
              }`}
            >
              <span className="text-4xl block mb-1">{m === "sms" ? "💬" : "🔗"}</span>
              {m === "sms" ? "SMS eller e-post" : "Lenke / nettadresse"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 mb-4 shadow-sm">
          <label className="block text-lg font-medium text-slate-600 mb-2">
            {mode === "sms" ? "Lim inn meldingen her:" : "Lim inn lenken her:"}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "sms"
              ? "F.eks: «Din konto er sperret. Logg inn nå: ...»"
              : "F.eks: https://dnb-sikker.com/logg-inn"}
            rows={5}
            className="w-full text-xl text-slate-800 placeholder-slate-300 resize-none border-0 outline-none bg-transparent leading-relaxed"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !input.trim()}
            className="w-full mt-4 py-5 rounded-xl text-2xl font-bold transition-all
              disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed
              bg-blue-700 text-white hover:bg-blue-800 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Sjekker…
              </span>
            ) : "Sjekk nå"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4 text-red-700 text-lg">
            {error}
          </div>
        )}

        {/* Result */}
        {result && style && (
          <div className={`${style.bg} border-2 ${style.border} rounded-2xl p-6 mb-4`}>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-5xl">{result.emoji}</span>
              <div>
                <div className={`text-sm font-bold uppercase tracking-widest ${style.textColor} mb-0.5`}>
                  {style.label}
                </div>
                <div className={`text-2xl font-bold ${style.titleColor}`}>{result.title}</div>
              </div>
            </div>
            <p className={`text-lg leading-relaxed mb-4 ${style.textColor}`}>{result.explanation}</p>
            {result.tips?.length > 0 && (
              <ul className="space-y-2 mb-4">
                {result.tips.map((tip, i) => (
                  <li key={i} className={`text-base flex gap-2 ${style.textColor}`}>
                    <span className="font-bold">→</span><span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Database results */}
            {result.checkedDatabases?.length > 0 && (
              <div className="mt-4 border-t border-current border-opacity-20 pt-4">
                <button
                  onClick={() => setShowDatabases(!showDatabases)}
                  className={`text-sm font-medium flex items-center gap-2 ${style.textColor}`}
                >
                  <span>🔍 Sjekket {result.checkedDatabases.length} databaser</span>
                  <span>{showDatabases ? "▲" : "▼"}</span>
                </button>

                {showDatabases && (
                  <div className="mt-3 space-y-2">
                    {result.checkedDatabases.map((db, i) => (
                      <div key={i} className="flex items-center justify-between bg-white bg-opacity-50 rounded-xl px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-slate-700">{db.name}</span>
                          <p className="text-xs text-slate-500">{db.description}</p>
                        </div>
                        <span className={`text-lg flex-shrink-0 ml-2 ${db.found ? "text-red-600" : "text-green-600"}`}>
                          {db.found ? "🚨" : "✅"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {result && (
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 mb-6 shadow-sm">
            {!showReport ? (
              <button
                onClick={() => setShowReport(true)}
                className="w-full py-4 text-lg text-red-600 border-2 border-red-100 rounded-xl hover:bg-red-50 transition-colors font-medium"
              >
                ⚠️ Rapporter dette som svindel
              </button>
            ) : reportSent ? (
              <p className="text-center text-green-700 text-lg py-2 font-medium">
                ✓ Takk! Rapporten er sendt.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-base text-slate-500">Legg til detaljer (valgfritt):</p>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="F.eks: Fikk denne fra ukjent nummer…"
                  rows={3}
                  className="w-full text-lg text-slate-700 placeholder-slate-300 border-2 border-slate-200 rounded-xl p-3 resize-none outline-none focus:border-blue-400"
                />
                <button
                  onClick={handleReport}
                  className="w-full py-4 bg-red-600 text-white text-lg font-bold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Send rapport
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-white rounded-2xl border-2 border-blue-100 p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-slate-700 mb-4">🔎 Slik kjenner du igjen svindel</h2>
          <ul className="space-y-4">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                <span className="text-lg text-slate-600 leading-snug">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Nødnumre */}
        <div className="bg-blue-900 rounded-2xl p-5 mb-6 text-white">
          <h2 className="text-lg font-bold mb-3">📞 Nyttige numre</h2>
          <div className="space-y-2 text-base">
            <div className="flex justify-between"><span>Politiet</span><span className="font-bold">02800</span></div>
            <div className="flex justify-between"><span>Svindelvarsling (Forbrukerrådet)</span><span className="font-bold">23 40 06 00</span></div>
            <div className="flex justify-between"><span>Nødnummer</span><span className="font-bold">112</span></div>
          </div>
        </div>

        <p className="text-center text-base text-slate-400 pb-4">
          SvindelSjekk er gratis. Vi lagrer ikke meldingene dine.
        </p>
        <Link href="/statistikk" className="block text-center text-base text-blue-500 hover:text-blue-700 underline pb-6">
          📊 Se statistikk over innrapporterte svindler →
        </Link>
        <p className="hidden">
        </p>
      </div>
    </div>
  );
}