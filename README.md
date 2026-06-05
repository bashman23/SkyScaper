# Map Measurement

Free satellite measurement web app for estimating building footprints, parking lot areas, perimeters, and distances.

## Local Development

1. Copy `.env.example` to `.env`.
2. Set `VITE_MAPBOX_ACCESS_TOKEN`.
3. Run:

```powershell
npm install
npm run dev -- --port 5317 --strictPort
```

## Public Launch Settings

Required environment variables:

- `VITE_MAPBOX_ACCESS_TOKEN`: public Mapbox token for satellite imagery.
- `VITE_ADSENSE_CLIENT_ID`: optional AdSense publisher id, such as `ca-pub-...`.
- `VITE_ADSENSE_SLOT_PANEL`: optional AdSense slot id for the measurement panel.
- `VITE_SITE_ORIGIN`: production site origin used to generate `sitemap.xml`, such as `https://example.com`.
- `VITE_CONTACT_EMAIL`: monitored public contact email for privacy, support, and advertising inquiries.

Recommended Mapbox restrictions:

- Restrict the token to the production domain and localhost during development.
- Monitor usage because every visitor can generate map tile traffic.

Recommended ad launch steps:

- Create/approve a Google AdSense property for the production domain.
- Add the publisher id and slot id as production environment variables.
- Run a production build after setting `VITE_ADSENSE_CLIENT_ID`; the build generates `ads.txt`.
- Set `VITE_CONTACT_EMAIL` so `/contact` and privacy-related copy point users to a monitored owner inbox.
- Review `/guide`, `/privacy`, `/terms`, `/about`, and `/contact` before submitting the site for ad approval.
- The app asks users to allow sponsor ads before loading AdSense. Review whether additional consent management is required for the regions where the public site will be marketed.

## Deployment

This repo includes:

- `netlify.toml` for Netlify static hosting.
- `vercel.json` for Vercel static hosting.
- `.openai/hosting.json` plus `npm run build:sites` for the OpenAI Sites deployment artifact.

The current OpenAI Sites deployment is online but access-gated by OpenAI workspace authentication. For public professional users, deploy the same repo to a public host such as Netlify, Vercel, Cloudflare Pages, or another public static host.

Public launch checklist:

- Production host serves `/`, `/guide`, `/about`, `/privacy`, `/terms`, and `/contact` without login.
- Mapbox token is restricted to localhost and the production domain.
- AdSense account, domain, publisher id, and slot id are approved.
- `/ads.txt` contains the approved publisher id.
- `/sitemap.xml` uses the production origin.
- Privacy contact is real and monitored.
- A quick browser test confirms satellite imagery, drawing, autosave, export, and ad-slot rendering.

## Verification

```powershell
npm run test:run
npm run build
npm audit
```
