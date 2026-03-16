<div align="center">

<img src="https://img.shields.io/badge/SvindelSjekk-Anti--Scam%20Platform-1d4ed8?style=for-the-badge&logo=shield&logoColor=white" alt="SvindelSjekk" />

# 🛡️ SvindelSjekk

**Real-time scam detection platform for Norway**

Gratis · Ingen innlogging · Optimalisert for eldre brukere

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-svindel--sjekk--zch7.vercel.app-1d4ed8?style=flat-square)](https://svindel-sjekk-zch7.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?style=flat-square&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Timestamped](https://img.shields.io/badge/Ownership-OpenTimestamps_Verified-orange?style=flat-square)](https://opentimestamps.org)

</div>

---

## 📌 Om prosjektet

**SvindelSjekk** er en gratis webapplikasjon som hjelper nordmenn — særlig eldre — med å sjekke om en SMS, e-post eller lenke er svindel. Ingen registrering, ingen lagring av meldinger.

Norge er blant landene med høyest forekomst av digital svindel i Norden. SvindelSjekk er bygget for å gi alle enkel tilgang til kraftige verktøy som tidligere bare var tilgjengelige for eksperter.

> 🕐 **Intellectual property notice:** This project has been cryptographically timestamped via [OpenTimestamps](https://opentimestamps.org) — a blockchain-based proof of existence service. The timestamp provides immutable proof of the project's creation date and ownership.

---

## ✨ Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| 🔍 **5-lags deteksjon** | Google Safe Browsing + destroy.tools + URLhaus + VirusTotal + pattern matching |
| 💬 **SMS & lenkesjekk** | Analyser meldingstekst eller bare lim inn en URL |
| 📊 **Live statistikk** | Dashboard med daglige trender og hvilke databaser som oppdager mest |
| 📰 **Nyheter & advarsler** | Blogg med siste svindelforsøk i Norge |
| 🚨 **Rapportering** | Brukere kan rapportere svindel — lagres i Supabase |
| 📞 **Nødnumre** | Direkte tilgang til Politiet, Forbrukerrådet og nødnummer |
| 🇳🇴 **Norsk UI** | Fullt norsk grensesnitt, stor tekst for eldre brukere |
| ⚡ **Ingen innlogging** | Fungerer umiddelbart uten konto eller registrering |

---

## 🔒 Sikkerhetsarkitektur

SvindelSjekk bruker **5 parallelle lag** for å oppdage trusler:

```
Bruker sender inn SMS / lenke
              │
    ┌─────────┴──────────┐
    │   Parallelanalyse  │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────────────────────────────────┐
    │  1. Google Safe Browsing  — phishing & malware  │
    │  2. destroy.tools         — domenetrusler        │
    │  3. URLhaus (abuse.ch)    — malware & botnett    │
    │  4. VirusTotal            — 70+ AV-motorer       │
    │  5. Pattern matching      — norske svindelord    │
    └─────────┬──────────────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  FARLIG / MISTENKELIG / TRYGG  │
    └────────────────────┘
```

---

## 🛠️ Tech Stack

| Lag | Teknologi |
|-----|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | Vercel (Edge Network) |
| **APIs** | Google Safe Browsing, destroy.tools, URLhaus, VirusTotal |

---

## 🚀 Kom i gang

### Forutsetninger

- [Node.js](https://nodejs.org) v18 eller nyere
- [Git](https://git-scm.com)
- Gratis kontoer på: [Vercel](https://vercel.com), [Supabase](https://supabase.com)

### Installasjon

```bash
# 1. Klon repoet
git clone https://github.com/CodeBerserkers888/SvindelSjekk.git
cd SvindelSjekk

# 2. Installer avhengigheter
npm install

# 3. Konfigurer miljøvariabler
cp .env.example .env.local
# Rediger .env.local og legg inn API-nøkler

# 4. Start utviklingsserver
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

### Miljøvariabler

```env
# Google Safe Browsing (gratis) — console.cloud.google.com
GOOGLE_SAFE_BROWSING_API_KEY=din_nokkel

# VirusTotal (gratis) — virustotal.com
VIRUSTOTAL_API_KEY=din_nokkel

# Supabase — supabase.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=din_service_role_nokkel
```

### Database (Supabase SQL)

```sql
CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text_preview text,
  verdict text,
  note text,
  lang text DEFAULT 'no',
  sources text,
  ip text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,
  content text,
  category text DEFAULT 'svindel',
  published boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

---

## 📁 Prosjektstruktur

```
src/
├── app/
│   ├── api/
│   │   ├── check/          ← Hoved-analyse (alle 5 API-er parallelt)
│   │   ├── report/         ← Lagre svindelrapporter til Supabase
│   │   ├── stats/          ← Statistikk-API
│   │   └── blog/           ← Blogg-API (liste + enkeltinnlegg)
│   ├── nyheter/            ← Svindelnyheter og advarsler
│   │   └── [slug]/         ← Enkeltartikkel
│   ├── statistikk/         ← Live statistikkside
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── ScamChecker.tsx     ← Hoved-UI-komponent
└── lib/
    └── translations.ts
```

---

## 🌐 Deploy på Vercel

```bash
# 1. Push til GitHub
git push origin main

# 2. Importer på vercel.com → Add New Project
# 3. Legg til miljøvariabler i Settings → Environment Variables
# 4. Deploy — automatisk ved hver git push
```

---

## 🗺️ Veikart

- [x] Google Safe Browsing API
- [x] destroy.tools API
- [x] URLhaus (abuse.ch) API
- [x] VirusTotal API
- [x] Supabase rapportering
- [x] Statistikkdashboard
- [x] Nyheter og advarselsblogg
- [ ] Claude AI — intelligent tekstanalyse
- [ ] PWA — installer som app på telefon
- [ ] RSS-feed for automatiske nyheter
- [ ] Rate limiting
- [ ] Admin-panel for blogginnlegg
- [ ] Analyse av telefonnumre

---

## 🔐 Intellectual Property

This project has been cryptographically timestamped using **[OpenTimestamps](https://opentimestamps.org)** — a free, open-source protocol that uses the Bitcoin blockchain to provide immutable proof of existence.

The timestamp serves as verifiable evidence of:
- The project's creation date
- Code ownership by the author
- Priority of intellectual property

> *"A timestamp proves that a document existed at a certain point in time. OpenTimestamps uses the Bitcoin blockchain as a decentralized, tamper-proof notary."*

---

## 📄 Lisens

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">

Laget med ❤️ for å beskytte nordmenn mot svindel

**[🌐 Live Demo](https://svindel-sjekk-zch7.vercel.app)** · **[🐛 Rapporter en feil](https://github.com/CodeBerserkers888/SvindelSjekk/issues)** · **[⭐ Gi en stjerne](https://github.com/CodeBerserkers888/SvindelSjekk)**

</div>