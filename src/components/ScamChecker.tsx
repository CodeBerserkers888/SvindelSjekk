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
      body: JSON.stringify({ text: input, note: reportNote, verdict: result?.verdict, sources: result?.sources, lang: "no" }),
    });
    setReportSent(true);
  };

  const verdictConfig = {
    FARLIG:      { bg: "bg-red-50",   border: "border-red-300",   title: "text-red-900",   body: "text-red-700",   badge: "bg-red-600 text-white",   label: "SVINDEL" },
    MISTENKELIG: { bg: "bg-amber-50", border: "border-amber-300", title: "text-amber-900", body: "text-amber-700", badge: "bg-amber-500 text-white",  label: "MISTENKELIG" },
    TRYGG:       { bg: "bg-emerald-50", border: "border-emerald-300", title: "text-emerald-900", body: "text-emerald-700", badge: "bg-emerald-600 text-white", label: "TRYGG" },
  };

  const v = result ? verdictConfig[result.verdict] : null;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Georgia', serif" }}>

      {/* Hero header */}
      <div className="bg-gradient-to-b from-blue-950 to-blue-900 pt-10 pb-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-800 border-2 border-blue-600 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
                <path d="M32 6L10 16v18c0 13 10 24 22 26 12-2 22-13 22-26V16L32 6z" fill="#1e40af" stroke="#60a5fa" strokeWidth="2.5"/>
                <path d="M22 32l7 7 13-13" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">SvindelSjekk</h1>
          <p className="text-blue-300 text-lg">Er denne meldingen svindel?</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8">

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 mb-5">

          {/* Mode tabs */}
          <div className="flex gap-2 mb-5 bg-slate-100 rounded-2xl p-1">
            {(["sms", "link"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setError(""); }}
                className={`flex-1 py-3 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 ${
                  mode === m ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{m === "sms" ? "💬" : "🔗"}</span>
                {m === "sms" ? "SMS / E-post" : "Lenke"}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "sms"
              ? "Lim inn meldingen her…\n\nF.eks: «Din konto er sperret. Logg inn nå»"
              : "Lim inn lenken her…\n\nF.eks: https://dnb-sikker.com/logg-inn"}
            rows={5}
            className="w-full text-lg text-slate-800 placeholder-slate-300 resize-none border-0 outline-none bg-slate-50 rounded-2xl p-4 leading-relaxed mb-4"
            style={{ fontFamily: "'Georgia', serif" }}
          />

          <button
            onClick={handleCheck}
            disabled={loading || !input.trim()}
            className="w-full py-4 rounded-2xl text-xl font-bold transition-all
              disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed
              bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Sjekker…
              </span>
            ) : "Sjekk nå →"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-red-700 text-base">
            {error}
          </div>
        )}

        {/* Result */}
        {result && v && (
          <div className={`${v.bg} border-2 ${v.border} rounded-3xl p-6 mb-4 shadow-sm`}>
            <div className="flex items-start gap-4 mb-4">
              <span className="text-5xl">{result.emoji}</span>
              <div className="flex-1">
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-2 ${v.badge}`}>
                  {v.label}
                </span>
                <h2 className={`text-xl font-bold leading-snug ${v.title}`}>{result.title}</h2>
              </div>
            </div>
            <p className={`text-base leading-relaxed mb-4 ${v.body}`}>{result.explanation}</p>

            {result.tips?.length > 0 && (
              <div className="space-y-2 mb-4">
                {result.tips.map((tip, i) => (
                  <div key={i} className={`flex gap-3 items-start text-sm ${v.body}`}>
                    <span className="font-bold mt-0.5">→</span><span>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Database accordion */}
            {result.checkedDatabases?.length > 0 && (
              <div className="border-t border-current border-opacity-20 pt-4 mt-2">
                <button
                  onClick={() => setShowDatabases(!showDatabases)}
                  className={`text-sm font-semibold flex items-center gap-2 w-full ${v.body}`}
                >
                  <span>🔍 Sjekket {result.checkedDatabases.length} databaser</span>
                  <span className="ml-auto">{showDatabases ? "▲" : "▼"}</span>
                </button>
                {showDatabases && (
                  <div className="mt-3 space-y-2">
                    {result.checkedDatabases.map((db, i) => (
                      <div key={i} className="flex items-center justify-between bg-white bg-opacity-60 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{db.name}</p>
                          <p className="text-xs text-slate-500">{db.description}</p>
                        </div>
                        <span className="text-lg ml-3 flex-shrink-0">{db.found ? "🚨" : "✅"}</span>
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
          <div className="bg-white rounded-3xl border border-slate-200 p-5 mb-5 shadow-sm">
            {!showReport ? (
              <button
                onClick={() => setShowReport(true)}
                className="w-full py-3 text-base text-red-600 border border-red-200 rounded-2xl hover:bg-red-50 transition-colors font-semibold"
              >
                ⚠️ Rapporter dette som svindel
              </button>
            ) : reportSent ? (
              <p className="text-center text-emerald-700 text-base py-2 font-semibold">✓ Takk! Rapporten er sendt.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 font-medium">Legg til detaljer (valgfritt):</p>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="F.eks: Fikk denne fra ukjent nummer…"
                  rows={3}
                  className="w-full text-base text-slate-700 placeholder-slate-300 border border-slate-200 rounded-xl p-3 resize-none outline-none focus:border-blue-400 bg-slate-50"
                />
                <button onClick={handleReport} className="w-full py-3 bg-red-600 text-white text-base font-bold rounded-xl hover:bg-red-700 transition-colors">
                  Send rapport
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-4">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>🔎</span> Slik kjenner du igjen svindel
          </h2>
          <ul className="space-y-3">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-blue-900 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
                <span className="text-base text-slate-600 leading-snug">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Emergency numbers */}
        <div className="bg-blue-950 rounded-3xl p-5 mb-4 text-white shadow-sm">
          <h2 className="text-base font-bold mb-3 text-blue-300 uppercase tracking-wider">📞 Nyttige numre</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-blue-800 pb-3">
              <span className="text-base text-blue-100">Politiet</span>
              <span className="text-xl font-bold text-white">02800</span>
            </div>
            <div className="flex justify-between items-center border-b border-blue-800 pb-3">
              <span className="text-base text-blue-100">Forbrukerrådet svindel</span>
              <span className="text-xl font-bold text-white">23 40 06 00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base text-blue-100">Nødnummer</span>
              <span className="text-xl font-bold text-white">112</span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/nyheter" className="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-blue-400 hover:shadow-md transition-all shadow-sm">
            <span className="text-2xl block mb-1">📰</span>
            <span className="text-sm font-bold text-slate-700">Svindelnyheter</span>
            <p className="text-xs text-slate-400 mt-1">Siste advarsler</p>
          </Link>
          <Link href="/statistikk" className="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-blue-400 hover:shadow-md transition-all shadow-sm">
            <span className="text-2xl block mb-1">📊</span>
            <span className="text-sm font-bold text-slate-700">Statistikk</span>
            <p className="text-xs text-slate-400 mt-1">Innrapportert svindel</p>
          </Link>
        </div>

        {/* Footer — Trygg På Nett */}
        <div className="border-t border-blue-100 pt-6 pb-8 mt-2">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-slate-400 text-center">
              SvindelSjekk er gratis. Vi lagrer ikke meldingene dine.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Et initiativ av</span>
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 6v7c0 5.25 4.05 10.15 9 11.25C17.95 23.15 21 18.25 21 13V6L12 2z"
                    fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="0.5"/>
                  <path d="M8 12.5l2.5 2.5 5.5-5.5"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-bold text-blue-800 tracking-tight">Trygg</span>
                <span className="text-sm font-light text-blue-600 tracking-tight">På Nett</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 text-center">
              Beskytt deg og dine mot svindel på nett
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}