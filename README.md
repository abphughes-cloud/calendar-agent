# Calendar Planner — Milestone 1

A minimal Next.js app that signs in with Google (read-only Calendar access)
and displays your week as a calendar-style time grid, merging events from
every calendar in your Google account — your primary calendar plus any
other calendars you have selected in Google Calendar (including ICS/
subscription calendars under "Other calendars").

This is a planning layer, not a calendar editor: the app never writes to
Google Calendar.

## Tech

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Auth.js (`next-auth` v5) with the Google provider
- Google Calendar API (`calendarList` + `events`, called directly via
  `fetch` with a Bearer access token), read-only scope

## 1. Create a Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create (or select) a project, then enable the **Google Calendar API**.
3. Under **APIs & Services → Credentials**, create an **OAuth client ID**
   of type **Web application**.
4. Add this Authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Copy the generated **Client ID** and **Client secret**.
6. On the **OAuth consent screen**, add yourself as a test user (if the app
   is in Testing mode) so you can sign in.

## 2. Configure environment variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

- `NEXTAUTH_URL` — leave as `http://localhost:3000` for local dev.
- `NEXTAUTH_SECRET` — any random string, e.g. generate one with
  `openssl rand -base64 32`.
- `GOOGLE_CLIENT_ID` — from step 1.
- `GOOGLE_CLIENT_SECRET` — from step 1.

`.env.local` is gitignored and never committed.

## 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Sign in with
Google**, and grant read-only Calendar access. You'll see a 7-day week grid
(06:00–23:00) with events positioned by start/end time, prev/next week
navigation, and a "Today" shortcut.

## Event categories

Events are colored by category, derived from their source calendar's name
(see `categorizeEvent` in [src/lib/category.ts](src/lib/category.ts)) —
no raw calendar name is shown on the cards, only color:

| Calendar name contains | Category  | Color  |
| ----------------------- | --------- | ------ |
| `lwf`                    | Hockey    | blue   |
| `LBS` / `LBS Live`       | Academic  | orange |
| `Roundabout`             | Clubs     | green  |
| `Calendar`               | Social    | purple |
| `Holiday`                | Holiday   | gray   |
| (none of the above)      | Other     | slate  |

A small legend above the grid shows all six categories.

## Notes

- Only the `calendar.readonly` scope is requested — this app cannot create,
  edit, or delete events.
- Calendars are included if they're selected in your Google Calendar UI
  (not hidden) and you have at least reader access — this covers ICS/
  subscription calendars under "Other calendars" too, as long as they're
  checked/visible in Google Calendar.
- A collapsible **debug panel** at the bottom of the page lists every
  calendar Google's `calendarList` API returned, whether it was included,
  and how many events were fetched (or the error) for each — useful if a
  calendar you expect to see is missing.
- Single-user, local app for now: no database, no multi-user accounts.
- Access tokens are refreshed automatically using the stored refresh token;
  if refresh ever fails you'll be asked to sign out and back in.
