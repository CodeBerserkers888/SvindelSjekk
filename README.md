# 🛡️ SvindelSjekk

Enkel og gratis webapp som hjelper nordmenn å sjekke om en SMS, e-post eller lenke er svindel.
Ingen innlogging. Ingen lagring av meldinger.

---

## 🚀 Installasjon — steg for steg

### Steg 1 — Last ned og pakk ut prosjektet
Last ned ZIP-filen og pakk den ut på datamaskinen din.

### Steg 2 — Installer Node.js (hvis du ikke har det)
Gå til [nodejs.org](https://nodejs.org) og last ned **LTS**-versjonen.

### Steg 3 — Opprett GitHub-repo
1. Gå til [github.com](https://github.com) og logg inn
2. Klikk **New repository**
3. Navn: `svindelsjekk`
4. Klikk **Create repository**

### Steg 4 — Push koden til GitHub
Åpne terminal i prosjektmappen og kjør:
```bash
git init
git add .
git commit -m "SvindelSjekk første versjon"
git branch -M main
git remote add origin https://github.com/DITT-BRUKERNAVN/svindelsjekk.git
git push -u origin main
```

### Steg 5 — Deploy på Vercel
1. Gå til [vercel.com](https://vercel.com) og logg inn med GitHub
2. Klikk **Add New Project**
3. Velg `svindelsjekk`-repoet
4. Klikk **Deploy** — Vercel oppdager Next.js automatisk

### Steg 6 — Legg til Google Safe Browsing API (valgfritt, anbefalt)
1. Gå til [console.cloud.google.com](https://console.cloud.google.com)
2. Opprett nytt prosjekt → **APIs & Services → Library**
3. Søk etter **Safe Browsing API** og klikk **Enable**
4. Gå til **Credentials → Create API Key** → kopier nøkkelen
5. I Vercel: **Settings → Environment Variables**
   - Name: `GOOGLE_SAFE_BROWSING_API_KEY`
   - Value: din nøkkel
6. Klikk **Save** → **Redeploy**

✅ Ferdig! SvindelSjekk er live på din Vercel-adresse.

---

## 💻 Kjør lokalt

```bash
npm install
cp .env.example .env.local
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

---

## 📄 Lisens
MIT
