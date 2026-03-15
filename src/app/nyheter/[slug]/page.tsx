"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Post {
  title: string;
  slug: string;
  summary: string;
  content: string;
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

function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3" />;
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="flex gap-2 items-start text-lg text-slate-700 leading-relaxed mb-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-3" />
          <span>{line.slice(2)}</span>
        </li>
      );
    }
    if (line.startsWith("«") || line.includes("»")) {
      return (
        <blockquote key={i} className="border-l-4 border-blue-400 pl-4 my-4 text-lg text-slate-600 italic leading-relaxed">
          {line}
        </blockquote>
      );
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return <h3 key={i} className="text-xl font-bold text-slate-800 mt-6 mb-2">{line.slice(2, -2)}</h3>;
    }
    if (line.toUpperCase() === line && line.length > 10) {
      return <h3 key={i} className="text-xl font-bold text-slate-800 mt-6 mb-2">{line}</h3>;
    }
    return <p key={i} className="text-lg text-slate-700 leading-relaxed mb-2">{line}</p>;
  });
}

export default function PostPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog/post?slug=${encodeURIComponent(slug)}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then((data) => { if (data) { setPost(data); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [slug]);

  const cat = post ? (categoryStyle[post.category] || categoryStyle.svindel) : null;

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">

        <Link href="/nyheter" className="inline-flex items-center gap-2 text-blue-600 text-base mb-6 hover:text-blue-800">
          ← Tilbake til nyheter
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : notFound ? (
          <div className="bg-white rounded-2xl border-2 border-blue-100 p-8 text-center shadow-sm">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-lg text-slate-500">Innlegget ble ikke funnet.</p>
          </div>
        ) : post && cat ? (
          <article className="bg-white rounded-2xl border-2 border-blue-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cat.bg} ${cat.text}`}>{cat.label}</span>
              <span className="text-xs text-slate-400">{formatDate(post.published_at)}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3 leading-snug">{post.title}</h1>
            <p className="text-lg text-slate-500 mb-6 leading-relaxed border-b-2 border-blue-50 pb-6">{post.summary}</p>
            <ul className="space-y-0">
              {renderContent(post.content)}
            </ul>
          </article>
        ) : null}

        <div className="mt-6">
          <Link
            href="/"
            className="block w-full py-4 text-center bg-blue-700 text-white text-lg font-bold rounded-2xl hover:bg-blue-800 transition-colors"
          >
            Sjekk en melding nå →
          </Link>
        </div>
      </div>
    </div>
  );
}