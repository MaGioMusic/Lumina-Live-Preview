# Lumina Live Preview

Static pre-launch preview for `www.luminaestate.com`.

## What is included

- Static landing page files: `index.html`, `main.js`, `style.css`, `assets/`
- Public runtime config in `supabase-config.js`
- Protected newsletter signup with Supabase Edge Function source in `supabase/functions/newsletter-signup/index.ts`
- SQL hardening and rate-limit migration in `supabase/migrations/20260313_secure_newsletter_signup.sql`

## Launch Phase updates

`LAUNCH PHASE` is now manual and deployment-driven.

Update this value before each timeline update:

```js
window.LUMINA_PUBLIC_CONFIG = {
  launchPhase: {
    totalDays: 90,
    daysRemaining: 90
  }
};
```

- `totalDays`: overall campaign window
- `daysRemaining`: current remaining time that you want the live site to show

If you later want the page to show 64 days remaining, only change `daysRemaining` to `64` and redeploy.

## Turnstile before production

Replace the test Turnstile site key in `supabase-config.js` with the real production site key.

Set the real secret in the Supabase Edge Function secrets:

- `CLOUDFLARE_TURNSTILE_SECRET_KEY`

Do not put the Turnstile secret in the browser code.

## Cloudflare Pages deployment

Recommended settings for GitHub-based deploys:

- Framework preset: `None`
- Build command: `bash .cloudflare/pages-build.sh`
- Build output directory: `dist`

This build copies only the public website files into `dist`, so helper scripts and Supabase source files are not exposed as static assets.

## Custom domain

Attach:

- `www.luminaestate.com`

Recommended redirect:

- `luminaestate.com` -> `https://www.luminaestate.com`
