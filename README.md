# Household

A private Android app for two people: shopping list, meal planner with recipes, shared calendar, chores and reminders, bills and wish lists.

## How the pieces fit

| Part | Where | Cost |
| --- | --- | --- |
| API (`worker/`) | Cloudflare Workers, deployed by Cloudflare Workers Builds on every push, database on Cloudflare D1 | Free plan |
| Phone app (`app/`) | Expo (React Native), installed as an APK | Free |
| APK builds | GitHub Actions, `Build Android app` workflow | Free |
| Over the air updates | Expo EAS Update, run by the Expo workflow in `app/.eas/workflows/update.yml` | Free plan |
| Push notifications | Expo push service through Firebase Cloud Messaging | Free |

## Everyday use

* Change screens or logic under `app/src`, push to `main`, and both phones pick up the update on next launch.
* Change the API under `worker/`, push to `main`, and Cloudflare runs `npm run deploy`, which applies database migrations and deploys.
* Change native settings (`app/app.json`, new native packages, icon), bump `version` in `app/app.json`, then run `Build Android app` and install the new APK from the release page.

## GitHub secrets


## Local development

```
cd worker && npx wrangler d1 migrations apply household --local && npx wrangler dev
cd app && API_URL=http://127.0.0.1:8787 npx expo start --web
```

The Android signing key lives in `app/signing/release.keystore` (alias `androiddebugkey`, password `android`). Keep this repository private.
