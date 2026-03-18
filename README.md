<div align="center">

<img src="https://img.shields.io/badge/SvindelSjekk-Anti--Scam%20Platform-1d4ed8?style=for-the-badge&logo=shield&logoColor=white" alt="SvindelSjekk" />

# 🛡️ SvindelSjekk

**Real-time scam detection platform for Norway**

Gratis · Ingen innlogging · Optimalisert for eldre brukere

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-svindel--sjekk--zch7.vercel.app-1d4ed8?style=flat-square)](https://svindelsjekk.no)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?style=flat-square&logo=vercel)](https://vercel.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5a0fc8?style=flat-square&logo=pwa)](https://svindelsjekk.no)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Timestamped](https://img.shields.io/badge/Ownership-OpenTimestamps_Verified-orange?style=flat-square)](https://opentimestamps.org)

</div>

---

## 📌 Om prosjektet

**SvindelSjekk** er en gratis webapplikasjon som hjelper nordmenn — særlig eldre — med å sjekke om en SMS, e-post eller lenke er svindel. Ingen registrering, ingen innlogging, ingen lagring av meldinger.

Norge er blant landene med høyest forekomst av digital svindel i Norden. Ifølge NORSIS opplevde over 170 000 nordmenn identitetstyveri i 2024 alene. SvindelSjekk er bygget for å gi alle enkel tilgang til kraftige verktøy som tidligere bare var tilgjengelige for eksperter.

> 🔐 **Intellectual property notice:** This project has been cryptographically timestamped via [OpenTimestamps](https://opentimestamps.org) — a blockchain-based proof of existence service providing immutable proof of creation date and ownership.

---

## ✨ Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| 🔍 **11-lags deteksjon** | 11 sikkerhetsdatabaser sjekkes parallelt på under 2 sekunder |
| 💬 **SMS & lenkesjekk** | Analyser meldingstekst eller lim inn en URL |
| 🔎 **Typosquatting-detektor** | Oppdager domener som ligner nav.no, skatteetaten.no, dnb.no osv. |
| 📅 **WHOIS domenealder** | Flaggger domener registrert for mindre enn 30 dager siden |
| 📊 **Live statistikk** | Dashboard med daglige trender og hvilke databaser som oppdager mest |
| 📰 **Nyheter & advarsler** | Blogg med siste svindelforsøk i Norge |
| 🚨 **Rapportering** | Brukere kan rapportere svindel — lagres i Supabase |
| 🛡️ **Rate limiting** | Maks 20 sjekk per time per IP — beskytter API-ressurser |
| 📱 **PWA** | Kan installeres som app på telefon og nettbrett |
| 📞 **Nødnumre** | Direkte tilgang til Politiet, Forbrukerrådet og nødnummer |
| 🇳🇴 **Norsk UI** | Fullt norsk grensesnitt, stor tekst for eldre brukere |
| ⚡ **Ingen innlogging** | Fungerer umiddelbart uten konto eller registrering |

---

## 🔒 Sikkerhetsarkitektur — 11 lag

```
Bruker sender inn SMS / lenke
              │
    ┌─────────┴──────────────────────┐
    │      11 parallelle sjekker     │
    └─────────┬──────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────┐
    │  1.  Google Safe Browsing   — phishing & malware      │
    │  2.  destroy.tools          — domenetrusler           │
    │  3.  URLhaus (abuse.ch)     — malware & botnett       │
    │  4.  VirusTotal             — 70+ AV-motorer          │
    │  5.  PhishTank (OpenDNS)    — crowdsourcet phishing   │
    │  6.  ThreatFox (abuse.ch)   — malware IOC-database    │
    │  7.  Cloudflare Radar       — sanntids URL-analyse    │
    │  8.  WHOIS domenealder      — ny domene < 30 dager    │
    │  9.  Typosquatting          — ligner nav.no/dnb.no?   │
    │  10. Nøkkelord-analyse      — norske svindeluttrykk   │
    │  11. URL-mønsteranalyse     — korte lenker & .xyz     │
    └─────────┬────────────────────────────────────────────┘
              │
    ┌─────────▼──────────────┐
    │  FARLIG / MISTENKELIG / TRYGG  │
    └────────────────────────┘
```

---

## 🛠️ Tech Stack

| Lag | Teknologi |
|-----|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | Vercel (Edge Network) |
| **PWA** | Service Worker, Web App Manifest |
| **Rate Limiting** | In-memory rate limiter (20 req/time/IP) |
| **Sikkerhet** | Google Safe Browsing, destroy.tools, URLhaus, VirusTotal, PhishTank, ThreatFox, Cloudflare Radar, WHOIS, Typosquatting |

---

## 🚀 Kom i gang

### Forutsetninger

- [Node.js](https://nodejs.org) v18 eller nyere
- [Git](https://git-scm.com)
- Gratis kontoer: [Vercel](https://vercel.com), [Supabase](https://supabase.com)

### Installasjon

```bash
# 1. Klon repoet
git clone https://github.com/CodeBerserkers888/SvindelSjekk.git
cd SvindelSjekk

# 2. Installer avhengigheter
npm install

# 3. Konfigurer miljøvariabler
cp .env.example .env.local

# 4. Start utviklingsserver
npm run dev
```

### Miljøvariabler

```env
# Google Safe Browsing (gratis) — console.cloud.google.com
GOOGLE_SAFE_BROWSING_API_KEY=din_nokkel

# VirusTotal (gratis) — virustotal.com
VIRUSTOTAL_API_KEY=din_nokkel

# Cloudflare Radar (gratis) — dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_RADAR_API_KEY=din_nokkel

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
│   │   ├── check/
│   │   │   ├── route.ts        ← 11-lags analyse
│   │   │   └── rate-limit.ts   ← Rate limiting
│   │   ├── report/             ← Lagre rapporter til Supabase
│   │   ├── stats/              ← Statistikk-API
│   │   └── blog/               ← Blogg-API
│   ├── nyheter/                ← Svindelnyheter
│   │   └── [slug]/             ← Enkeltartikkel
│   ├── statistikk/             ← Live statistikkside
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── ScamChecker.tsx         ← Hoved-UI
└── lib/
    └── translations.ts
```

---

## 🗺️ Veikart

- [x] Google Safe Browsing API
- [x] destroy.tools API
- [x] URLhaus (abuse.ch) API
- [x] VirusTotal API
- [x] PhishTank API
- [x] ThreatFox (abuse.ch) API
- [x] Cloudflare Radar API
- [x] WHOIS domenealder-sjekk
- [x] Typosquatting-detektor
- [x] Supabase rapportering
- [x] Statistikkdashboard
- [x] Nyheter og advarselsblogg
- [x] PWA — installer som app
- [x] Rate limiting
- [ ] Claude AI — intelligent tekstanalyse
- [ ] RSS-feed for automatiske nyheter
- [ ] Admin-panel for blogginnlegg
- [ ] Analyse av telefonnumre
- [ ] Egen domene svindelsjekk.no

---

## 🔐 Intellectual Property

This project has been cryptographically timestamped using **[OpenTimestamps](https://opentimestamps.org)** — a free, open-source protocol that uses the Bitcoin blockchain to provide immutable proof of existence.

---

## 📄 Lisens

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Laget med ❤️ for å beskytte nordmenn mot svindel

**[🌐 Live](https://svindelsjekk.no** · **[🐛 Rapporter en feil](https://github.com/CodeBerserkers888/SvindelSjekk/issues)** · **[⭐ Gi en stjerne](https://github.com/CodeBerserkers888/SvindelSjekk)**

</div>