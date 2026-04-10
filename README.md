<div align="center">

<img src="https://img.shields.io/badge/SvindelSjekk-Anti--Scam%20Platform-1d4ed8?style=for-the-badge&logo=shield&logoColor=white" alt="SvindelSjekk" />

# 🛡️ SvindelSjekk

**Real-time scam detection platform for Norway**

Gratis · Ingen innlogging · Optimalisert for eldre brukere

[![Live](https://img.shields.io/badge/🌐_Live-svindelsjekk.no-1d4ed8?style=flat-square)](https://svindelsjekk.no)
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
| 🔍 **20-lags deteksjon** | 20 sikkerhetsdatabaser og analyseverktøy sjekkes parallelt på under 2 sekunder |
| 💬 **SMS & lenkesjekk** | Analyser meldingstekst eller lim inn en URL |
| 🔎 **Typosquatting-detektor** | Oppdager domener som ligner nav.no, skatteetaten.no, dnb.no osv. |
| 🔤 **Homoglyph-detektor** | Oppdager lookalike-tegn (paypa1.com istedenfor paypal.com) |
| 📅 **WHOIS domenealder** | Flagger domener registrert for mindre enn 30 dager siden |
| 🔒 **SSL-sjekker** | Sjekker SSL-sertifikat og HTTPS-status |
| 📞 **Telefonnummer-analyse** | Oppdager premium-rate numre og mistenkelige utenlandske numre |
| 👤 **Avsender-analyse** | Sjekker om avsenderen utgir seg for å være en offentlig instans |
| 🔗 **Redirect chain** | Sporer URL-omdirigeringer til skjult destinasjon |
| 🏢 **Brreg.no register** | Sjekker org.nr. mot Brønnøysundregistrene |
| 🌐 **Shodan InternetDB** | Sjekker IP for kjente sårbarheter |
| 🚫 **AbuseIPDB** | Sjekker IP mot misbruks-database |
| 📧 **E-posthoder (SPF/DKIM/DMARC)** | Lim inn e-posthoder for autentisitetssjekk |
| 📊 **Live statistikk** | Dashboard med daglige trender og hvilke databaser som oppdager mest |
| 📰 **Nyheter & advarsler** | Blogg med siste svindelforsøk i Norge |
| 🚨 **Rapportering** | Brukere kan rapportere svindel — lagres i Supabase |
| 🛡️ **Rate limiting** | Maks 20 sjekk per time per IP — beskytter API-ressurser |
| 📱 **PWA** | Kan installeres som app på telefon og nettbrett |
| 📞 **Nødnumre** | Direkte tilgang til Politiet, Forbrukerrådet og nødnummer |
| 🇳🇴 **Norsk UI** | Fullt norsk grensesnitt, stor tekst for eldre brukere |
| ⚡ **Ingen innlogging** | Fungerer umiddelbart uten konto eller registrering |

---

## 🔒 Sikkerhetsarkitektur — 20 lag

```
Bruker sender inn SMS / lenke / e-post
              │
    ┌─────────┴──────────────────────┐
    │      20 parallelle sjekker     │
    └─────────┬──────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────┐
    │  1.  Google Safe Browsing    — phishing & malware     │
    │  2.  destroy.tools           — domenetrusler          │
    │  3.  URLhaus (abuse.ch)      — malware & botnett      │
    │  4.  VirusTotal              — 70+ AV-motorer         │
    │  5.  PhishTank (OpenDNS)     — crowdsourcet phishing  │
    │  6.  ThreatFox (abuse.ch)    — malware IOC-database   │
    │  7.  Cloudflare Radar        — sanntids URL-analyse   │
    │  8.  WHOIS domenealder       — ny domene < 30 dager   │
    │  9.  Typosquatting           — ligner nav.no/dnb.no?  │
    │  10. Nøkkelord-analyse       — 40+ norske svindelord  │
    │  11. Telefonnummer-analyse   — premium-rate & utland  │
    │  12. Avsender-analyse        — utgir seg for instans? │
    │  13. URL-mønsteranalyse      — korte lenker & .xyz    │
    │  14. Homoglyph-detektor      — lookalike-tegn i URL   │
    │  15. SSL-sjekker             — sertifikat & HTTPS     │
    │  16. Brreg.no register       — org.nr.-verifisering   │
    │  17. Shodan InternetDB       — IP-sårbarheter         │
    │  18. AbuseIPDB               — IP misbruks-database   │
    │  19. Redirect chain          — URL-omdirigering       │
    │  20. E-posthoder (SPF/DKIM/DMARC) — autentisitet     │
    └─────────┬────────────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────┐
    │  FARLIG / MISTENKELIG / TRYGG  │
    └────────────────────────────────┘
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
| **Sikkerhet** | Google Safe Browsing, destroy.tools, URLhaus, VirusTotal, PhishTank, ThreatFox, Cloudflare Radar, WHOIS, Typosquatting, Homoglyph, SSL, Brreg.no, Shodan, AbuseIPDB, Redirect chain, SPF/DKIM/DMARC |

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

```

### Database (Supabase SQL)

```sql

);
```

---

## 📁 Prosjektstruktur

```
src/
├── app/
│   ├── api/
│   │   ├── check/
│   │   │   ├── route.ts        ← 20-lags analyse
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
- [x] Nøkkelord-analyse (40+ norske svindeluttrykk)
- [x] Telefonnummer-analyse
- [x] Avsender-analyse
- [x] URL-mønsteranalyse
- [x] Homoglyph-detektor
- [x] SSL-sjekker
- [x] Brreg.no register
- [x] Shodan InternetDB
- [x] AbuseIPDB
- [x] Redirect chain
- [x] E-posthoder (SPF/DKIM/DMARC)
- [x] Supabase rapportering
- [x] Statistikkdashboard
- [x] Nyheter og advarselsblogg
- [x] PWA — installer som app
- [x] Rate limiting
- [x] Egen domene svindelsjekk.no
- [ ] Claude AI — intelligent tekstanalyse
- [ ] RSS-feed for automatiske nyheter
- [ ] Admin-panel for blogginnlegg

---

## 🔐 Intellectual Property

This project has been cryptographically timestamped using **[OpenTimestamps](https://opentimestamps.org)** — a free, open-source protocol that uses the Bitcoin blockchain to provide immutable proof of existence.

---

## 📄 Lisens

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Laget med ❤️ for å beskytte nordmenn mot svindel

**[🌐 Live](https://svindelsjekk.no)** · **[🐛 Rapporter en feil](https://github.com/CodeBerserkers888/SvindelSjekk/issues)** · **[⭐ Gi en stjerne](https://github.com/CodeBerserkers888/SvindelSjekk)**

</div>
