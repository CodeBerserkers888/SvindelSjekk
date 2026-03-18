"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  published_at: string;
}

const categoryStyle: Record<string, { bg: string; text: string; label: string }> = {
  advarsel: { bg: "bg-red-100", text: "text-red-700", label: "⚠️ Advarsel" },
  svindel:  { bg: "bg-amber-100", text: "text-amber-700", label: "🚨 Svindel" },
  tips:     { bg: "bg-blue-100", text: "text-blue-700", label: "💡 Tips" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
}

export default function NyheterPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json())
      .then((data) => { setPosts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
          <h1 className="text-3xl font-bold text-blue-900 mb-1">Nyheter og advarsler</h1>
          <p className="text-lg text-blue-700">Siste svindelforsøk i Norge</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-blue-100 p-8 text-center shadow-sm mb-5">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg text-slate-500">Ingen innlegg ennå.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {posts.map((post) => {
              const cat = categoryStyle[post.category] || categoryStyle.svindel;
              return (
                <Link key={post.id} href={`/nyheter/${post.slug}`}>
                  <div className="bg-white rounded-2xl border-2 border-blue-100 p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cat.bg} ${cat.text}`}>
                        {cat.label}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(post.published_at)}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 mb-2 leading-snug">{post.title}</h2>
                    <p className="text-base text-slate-500 leading-relaxed">{post.summary}</p>
                    <p className="text-sm text-blue-600 font-medium mt-3">Les mer →</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Link
          href="/"
          className="block w-full py-4 text-center bg-blue-700 text-white text-lg font-bold rounded-2xl hover:bg-blue-800 transition-colors"
        >
          ← Tilbake til SvindelSjekk
        </Link>

        {/* Footer — Trygg På Nett */}
        <div className="border-t border-blue-100 pt-6 pb-8 mt-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Et initiativ av</span>
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 6v7c0 5.25 4.05 10.15 9 11.25C17.95 23.15 21 18.25 21 13V6L12 2z" fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="0.5"/>
                  <path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-bold text-blue-800 tracking-tight">Trygg</span>
                <span className="text-sm font-light text-blue-600 tracking-tight">På Nett</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 text-center">Beskytt deg og dine mot svindel på nett</p>
          </div>
        </div>
      </div>
    </div>
  );
}