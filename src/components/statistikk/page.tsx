"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  farlig: number;
  mistenkelig: number;
  trygg: number;
  byDay: Record<string, { farlig: number; mistenkelig: number; trygg: number }>;
  topSources: { name: string; count: number }[];
}

export default function StatistikkPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const days = stats ? Object.entries(stats.byDay).slice(-7) : [];
  const maxDay = Math.max(...days.map(([, v]) => v.farlig + v.mistenkelig + v.trygg), 1);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <path d="M32 4L8 14v18c0 14 11 26 24 28 13-2 24-14 24-28V14L32 4z" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2.5"/>
              <path d="M22 32l7 7 13-13" stroke="#1d4ed8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-blue-900 mb-1">Statistikk</h1>
          <p className="text-lg text-blue-700">Innrapporterte svindelforsøk</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : stats ? (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 shadow-sm col-span-2 text-center">
                <p className="text-base text-slate-500 mb-1">Totalt innrapportert</p>
                <p className="text-5xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <div className="bg-red-50 rounded-2xl border-2 border-red-200 p-4 text-center">
                <p className="text-sm text-red-600 mb-1">Svindel</p>
                <p className="text-3xl font-bold text-red-800">{stats.farlig}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 p-4 text-center">
                <p className="text-sm text-amber-600 mb-1">Mistenkelig</p>
                <p className="text-3xl font-bold text-amber-800">{stats.mistenkelig}</p>
              </div>
            </div>

            {/* Chart — siste 7 dager */}
            {days.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 shadow-sm mb-5">
                <h2 className="text-lg font-bold text-slate-700 mb-4">📅 Siste 7 dager</h2>
                <div className="flex items-end gap-2 h-32">
                  {days.map(([date, val]) => {
                    const total = val.farlig + val.mistenkelig + val.trygg;
                    const heightPct = Math.round((total / maxDay) * 100);
                    const dayLabel = new Date(date).toLocaleDateString("no-NO", { weekday: "short" });
                    return (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
                          <div
                            className="w-full rounded-t-lg bg-red-400 transition-all"
                            style={{ height: `${heightPct}%`, minHeight: total > 0 ? "4px" : "0" }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{dayLabel}</span>
                        <span className="text-xs font-bold text-slate-700">{total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top sources */}
            {stats.topSources.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 shadow-sm mb-5">
                <h2 className="text-lg font-bold text-slate-700 mb-4">🔍 Oppdaget av</h2>
                <div className="space-y-3">
                  {stats.topSources.map((s, i) => {
                    const maxCount = stats.topSources[0].count;
                    const pct = Math.round((s.count / maxCount) * 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700 font-medium">{s.name}</span>
                          <span className="text-slate-500">{s.count}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.total === 0 && (
              <div className="bg-white rounded-2xl border-2 border-blue-100 p-8 text-center shadow-sm mb-5">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-lg text-slate-500">Ingen rapporter ennå.</p>
                <p className="text-base text-slate-400 mt-1">Rapporter en svindel fra forsiden!</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-red-50 rounded-2xl p-6 text-center text-red-700">
            Kunne ikke laste statistikk.
          </div>
        )}

        <Link
          href="/"
          className="block w-full py-4 text-center bg-blue-700 text-white text-lg font-bold rounded-2xl hover:bg-blue-800 transition-colors"
        >
          ← Tilbake til SvindelSjekk
        </Link>

        <p className="text-center text-sm text-slate-400 mt-4 pb-4">
          Kun innrapporterte svindelforsøk vises her.
        </p>
      </div>
    </div>
  );
}