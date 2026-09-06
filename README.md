# Tulip Track

A **neo-brutalist**, cross-platform attendance tracker built with **Tauri 2**, **Svelte 5**, **SvelteKit**, and **TypeScript**. Groups are optional — use it solo to track your own school attendance, or share with a team.

## Features

- **Individual attendance** — track your own attendance with two plain numbers ("days expected" vs "days present") plus daily Present / Absent / Holiday buttons; groups are fully optional
- **Daily marking** — tap Present / Absent / Holiday for today; tapping an active mark undoes it. Holiday days are excluded from your count entirely
- **Optional shared groups** — create a group, share its 6-character join code, members join and leave themselves; creators can regenerate the code or delete the group
- **Radar-free transparency** — in a group the roster shows everyone's status for the day; each person edits only their own
- **Holidays & off days** — groups can mark recurring off weekdays (e.g. Sundays) and name one-off holiday ranges; those days are skipped and never count toward attendance
- **Reports & analytics** — attendance trend, 4-status breakdown, per-member rates with 7/14/30/90-day presets
- **Export** — CSV and PDF (per-day grid + summary)
- **Reminders** — in-app + system notifications for days you haven't marked yourself yet
- **Neo-brutalist UI** — ink borders, hard offset shadows, cream paper, custom SVG icon set, progress rings
- **Demo mode out of the box** — no backend required

## Tech Stack

| Layer     | Choice                                             |
|-----------|----------------------------------------------------|
| Shell     | Tauri 2 (`tauri-shell` WebView)                    |
| Frontend  | Svelte 5 (runes) + SvelteKit (adapter-static SPA)  |
| Styling   | Custom neo-brutalist CSS design system (`app.css`) |
| Data      | Supabase (Postgres + RLS) **or** localStorage demo |
| Charts    | Chart.js                                           |
| Export    | jspdf + jspdf-autotable (PDF), custom CSV          |
| Notify    | `@tauri-apps/plugin-notification` (desktop/mobile) |

## Getting Started

```bash
# 0) One-time machine setup (see "Android" below for mobile builds)
export PATH="$HOME/.cargo/bin:$PATH"          # rustup installed with --no-modify-path

# 1) Install JS dependencies
npm install

# 2) Run the desktop app in dev mode
npm run tauri dev

# 3) Or run the frontend only (demo mode in the browser)
npm run dev
```

The app runs in **demo mode** when `.env` has no Supabase credentials. Sign in with:

```
email:    demo@tulip.app
password: demo1234
```

Demo data is auto-seeded into `localStorage` on first login, including a roster of student accounts you can
sign into (`mia@tulip.app`, `leon@tulip.app`, `ava@tulip.app`, `raj@tulip.app`, all password `demo1234`) to
experience the join-code flow — create a group as the demo user, sign out, join with the code as a student.

## Supabase (real backend)

1. Create a project at [supabase.com](https://supabase.com).
2. Create the `profiles`, `groups`, `group_memberships`, `attendance`, `holidays`, `personal_attendance`, and `personal_days` tables + Row Level Security policies by running `supabase/schema.sql` (SQL Editor).
3. Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env   # then edit VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

With credentials set, the app uses Supabase for auth + storage; RLS lets members read rosters and
attendance, groups be edited/deleted only by their creator, each user write only their own
attendance rows, and personal attendance totals be completely private to each user. Without credentials
it falls back to the localStorage demo backend — no code changes needed.

## Scripts

| Command                  | Description                                  |
|--------------------------|----------------------------------------------|
| `npm run dev`            | Frontend dev server (browser)                |
| `npm run tauri dev`      | Desktop app in dev mode                      |
| `npm run check`          | svelte-check (types + a11y) — 0 errors, 0 warnings |
| `npm run build`          | Production static build → `build/`           |
| `npm run tauri build`    | Production desktop bundles (deb/rpm/appimage)|
| `npm run tauri android dev`  | Run Android app on connected device       |
| `npm run tauri android build -- --apk --target aarch64` | Build Android APK   |

## Android

Android tooling is installed locally under `~/Android/Sdk` and a portable JDK under `~/.local/opt`. Set up the environment (or source `env.sh`):

```bash
source env.sh   # exports JAVA_HOME and ANDROID_HOME
```

| Step | Detail |
|------|--------|
| JDK   | Temurin 17 (`~/.local/opt/jdk-17.0.20.1+1`) |
| SDK   | `~/Android/Sdk` (platform-tools, platforms;android-35, build-tools;35.0.0, NDK 26.3, CMake 3.22.1) |
| Rust targets | aarch64/armv7/i686/x86_64-linux-android (installed across builds) |

Build an APK:

```bash
source env.sh
npm run tauri android build -- --apk --target aarch64
```

Output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`

> The unsigned APK needs a signing keystore to install. For local testing, generate one:
> ```bash
> keytool -genkey -v -keystore ~/tulip-track.keystore -alias tulip -keyalg RSA -keysize 2048 -validity 10000
> ```
> and configure `signingConfigs` in `src-tauri/gen/android/app/build.gradle.kts`.

## Project Layout

```
src/
├── lib/
│   ├── db.ts         # backend abstraction: Supabase OR localStorage demo (personal totals, groups, memberships, attendance)
│   ├── stats.ts      # stats engine (totals, daily series, per-user aggregates, 4 statuses)
│   ├── loaders.ts    # page data loaders (group snapshots)
│   ├── charts.ts     # chart.js wrappers (line, doughnut, bar)
│   ├── export.ts     # CSV + PDF export (Tauri dialog/fs or browser download)
│   ├── dates.ts      # date helpers + formatting
│   ├── notify.ts     # reminder scheduling / notifications
│   ├── reminders.ts  # post-sign-in incomplete-day checks
│   ├── session.ts    # auth/session helpers
│   ├── toasts.ts     # toast store
│   └── components/   # neo-brutalist UI kit + Modal/Toast/EmptyState/AppShell
└── routes/
    ├── +page.svelte      # dashboard (personal attendance hero, daily mark buttons, optional groups)
    ├── login/            # demo + Supabase login (seeded demo accounts listed)
    ├── groups/           # group list, create, join-by-code, owner controls
    ├── groups/[id]/      # join-code card, roster, self-service status marking, holidays
    ├── reports/          # charts + export (4 statuses)
    └── settings/         # profile, reminder prefs, backend info
```

## Notes & Limitations

- **Demo sharing is simulated** — localStorage lives in one browser profile, so "other members" are the seeded
  demo accounts you sign into on the same device. For real sharing, connect Supabase.
- **Reminders** are in-app (a timer scheduled while the app runs). There is no OS-level background scheduler — a due reminder fires only while the app is open. Scheduling recurring OS notifications on Android/iOS was intentionally left out.
- `npm run check` runs with **0 errors and 0 warnings**.