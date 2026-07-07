# Partizo

Vibe-based social app for the Indian market: swipe to connect based on a hybrid personality-quiz + interest-tag "vibe score," then plan real outings with a party-leader approval flow and auto-created group chats.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Framer Motion** for swipe gestures, transitions, and micro-interactions
- **Firebase** (Auth + Firestore) as the production backend
- A **local mock backend** (localStorage-based) so the whole app works instantly with zero setup, for demos and UI iteration

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. It starts in **mock mode** by default — sign up with any email/password, complete onboarding, and you'll be matched against ~12 seeded demo profiles. Everything (matches, outings, chats, notifications) is stored in your browser's localStorage, so it persists across refreshes but is local to your browser only.

> This project was scaffolded in a sandboxed environment with no npm registry access, so the code has been hand-written and reviewed but **not build-tested locally**. The first thing to do after `npm install` is run `npm run dev` and `npm run build` and fix any straggling type errors — Next.js/TypeScript error messages are usually one-line fixes (missing prop, import path casing, etc.).

## Switching to Firebase (production mode)

1. Create a project at the [Firebase console](https://console.firebase.google.com/).
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database** → create database (start in production mode).
4. **Project settings → General → Your apps** → add a Web app → copy the config values.
5. Copy `.env.local.example` to `.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values plus:
   ```
   NEXT_PUBLIC_DATA_MODE=firebase
   ```
6. Deploy the security rules in `firestore.rules` (Firestore → Rules tab in the console, paste the file contents, publish — or use the Firebase CLI: `firebase deploy --only firestore:rules`).
7. Restart the dev server. Every page already talks to Firestore/Auth through the same `dataProvider` interface — no UI code changes needed.

Both backends implement the exact same `DataProvider` interface (`lib/data/provider.ts`), so you can flip between them anytime by changing `NEXT_PUBLIC_DATA_MODE`.

## How the vibe score works

Onboarding has two parts that feed `lib/vibe.ts`:

- A 10-question personality quiz (`data/quiz.ts`) scores each user on 5 traits: extraversion, adventure, humor, depth, spontaneity.
- A curated set of India-relevant interest tags (`data/tags.ts`) the user picks 3-8 of.

`computeVibeScore(a, b)` = 60% cosine similarity of trait vectors + 40% Jaccard overlap of tags, giving a 0-100% score shown on every card and used to rank the swipe deck and the "Live Outings" feed (outings from higher-vibe leaders surface first).

## Pages

| Route | Purpose |
|---|---|
| `/login`, `/signup` | Email/password auth |
| `/onboarding` | 4-step profile setup: basics → photos → vibe tags → personality quiz |
| `/connect` | Bumble-style swipe deck, ranked by vibe score |
| `/outings` | Live outings feed + "My outings" tab |
| `/outings/[id]` | Outing detail; party leader accepts/rejects join requests here |
| `/chats`, `/chats/[id]` | Match chats and outing group chats |
| `/notifications` | New matches, join requests, acceptances, messages |
| `/profile` | Edit profile, verification badge, low-data mode, emergency contact, blocked list |

The floating **+** button (bottom right, visible on every app page) opens the create-outing sheet. The bottom nav covers all five core sections.

## India-market features included

- **Safety layer**: block & report (from any match chat's `⋮` menu), profile verification badge flow, an emergency contact field on the profile for future "share my outing" integrations.
- **Low-data mode**: toggle in Profile that turns off animated backgrounds and heavy blur effects — aimed at budget Android devices / patchy mobile data.

## Not yet wired (good next steps)

- Real photo upload to Firebase Storage (currently photos are stored as data URLs or picked from demo avatars — fine for a prototype, but Storage + resized variants is the right move before real users).
- Phone/OTP login (you chose email/password for v1; Firebase Auth supports phone auth if you want to add it later).
- An actual admin review queue for verification selfies (currently auto-approves after a few seconds in mock mode; in Firebase mode `verificationStatus` just flips to `pending` and needs a real reviewer/Cloud Function to flip it to `verified`).
- Push notifications (web push / FCM) — in-app notifications work today, but nothing fires when the tab is closed.
- Payments/premium tier — intentionally left out per your call to keep v1 free.

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. Import it in [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env.local` in the Vercel project settings (Settings → Environment Variables).
4. Deploy. Vercel runs `npm install` and `npm run build` for you, which will also be the first real compile check this project gets — check the build logs for any type errors on the first deploy.

## Project structure

```
app/                  routes (App Router)
  (app)/              authenticated shell: connect, outings, chats, notifications, profile
components/           SwipeCard, SwipeDeck, BottomNav, CreateOutingModal, etc.
context/              AuthContext, SettingsContext (low-data mode)
data/                 tags.ts, quiz.ts — the content behind the vibe score
lib/
  data/               provider.ts (interface), mock-provider.ts, firebase-provider.ts, index.ts (switch)
  mock/               localStorage-backed fake database + seed profiles
  types.ts            shared TypeScript types
  vibe.ts             the vibe-score algorithm
firestore.rules        security rules for Firebase mode
```
