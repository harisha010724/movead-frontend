# MoveAd Web

The `movead-web` repository from `MoveAd-Production-Architecture.md`: two React single-page
applications — the **advertiser portal** and the **admin (operations) console** — that share a
design system, an API client and build tooling, but compile to two independent bundles served
from two different origins.

This is a boilerplate. The structure, the money and date handling, the caching policy and the
authorisation model are production-shaped and meant to be kept. The page bodies are mostly
scaffolding for you to fill in.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # already present with mock mode enabled
npm run dev                    # http://localhost:5173
```

Then open:

- Sign in: http://localhost:5173/login — advertisers, drivers and operations alike

**One sign-in URL for all three products.** The audience in the login response
picks the dashboard, so an advertiser lands on `/`, an admin on `/admin` and a
driver on `/driver`, all from the same address. There used to be a login page
per portal; that only gave people a way to guess wrong and get bounced, since
the server was going to decide anyway. `/admin/login` and `/driver/login`
survive as redirects so old bookmarks still work.

Drivers use the username and password from their onboard email.

Production still builds two bundles (`npm run build:advertiser` / `build:admin`)
so admin code is never shipped to an advertiser's browser. The unified origin is
a local-dev convenience.

`VITE_USE_MOCK_API` decides which portals are served canned responses from
`src/shared/api/mock/`. It takes `true`, `false`, or a comma-separated list of portal names, so
one bundle can run against the real backend while the other still has no backend to run against.

`.env.local` ships with **`advertiser`**: the admin and driver portals talk to `movead-backend`
through `VITE_API_PROXY_TARGET`, and the advertiser portal stays on fixtures until campaigns
and billing exist. Driver login is the username and password from the onboard email. The one
advertiser-side page that is real, accepting an invitation, therefore needs
`VITE_USE_MOCK_API=false` to be tried end to end against a token from an actual email.

Two consequences worth knowing before you file a bug. The admin Dashboard and Campaigns pages
call endpoints the backend has not built, so **they 404 in this configuration**; set
`VITE_USE_MOCK_API=true` to look at them. And a **502 from the proxy** means nothing is answering
on `VITE_API_PROXY_TARGET`, not that the request was rejected — start `dev:api` in
`movead-backend`.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Unified local app on http://localhost:5173 (sign in at `/login`) |
| `npm run dev:advertiser` / `dev:admin` | Same as `dev` — both portals share the origin |
| `npm run build` | Typecheck, then build both bundles into `dist/advertiser` and `dist/admin` |
| `npm run typecheck` | `tsc -b` across app and build-tooling projects |
| `npm run lint` | ESLint with type-aware rules |
| `npm run format` | Prettier, including Tailwind class sorting |
| `npm test` | Vitest |
| `npm run api:sync` | Pull `openapi.json` from the backend and regenerate types |

---

## Why two bundles and not one app with role routing

Admin code — payout release, wallet adjustment, driver personal data — is never downloaded by an
advertiser's browser. Two entry points, two `dist` directories, two CloudFront distributions.
The cost is one extra build step; the benefit is that a routing bug cannot become a data breach.

`src/shared/` is compiled into both. `src/apps/advertiser/` and `src/apps/admin/` are compiled
into exactly one each.

```
src/
├── apps/
│   ├── advertiser/        index.html, main.tsx, AdvertiserApp.tsx, pages/
│   ├── admin/             index.html, main.tsx, AdminApp.tsx, pages/
│   └── driver/            DriverApp.tsx, pages/ (local unified app, mocked)
├── shared/
│   ├── api/               client, query client, keys, hooks, mock
│   ├── auth/              provider, guards, named permissions
│   ├── format/            ₹, km, % and Asia/Kolkata dates
│   ├── ui/                design system primitives
│   ├── layout/            app shell
│   ├── state/             zustand UI preferences
│   ├── config/            validated env
│   └── lib/               cn, monitoring, date ranges
└── styles/index.css       Tailwind v4 theme tokens
```

---

## The rules this scaffold enforces

### The client never calculates money

Money arrives from the API as a **decimal string**, typed as `Money` in
`src/shared/types/domain.ts`, because the backend stores `NUMERIC` and would lose precision
serialising to a JSON number. `src/shared/format/money.ts` converts to a number in exactly one
place, to hand the value to `Intl.NumberFormat`, and that result is never reused for arithmetic.

If you need a total, a subtotal or an estimate, **ask the API for it**. The campaign creation
page does this deliberately: "Calculate estimate" is a server round trip rather than a
multiplication in the browser, so there is only ever one implementation of the pricing rules.
An ESLint rule blocks `parseFloat` to make the accidental version harder to write.

Formatting uses `en-IN`, so ₹1,00,000 groups in lakhs rather than as ₹100,000.

### Dates are Asia/Kolkata, always

`src/shared/format/datetime.ts` pins every date to the platform timezone rather than the
browser's. A user in London must see the same "17 August" the billing engine used, or a
dashboard and an invoice will disagree by a day at the boundary.

### Three cache freshness profiles, chosen per query

`src/shared/api/queryClient.ts` defines `reference`, `aggregate` and `live`. Live vehicle
positions poll every ten seconds with `refetchIntervalInBackground: false` — an advertiser who
leaves the map open overnight would otherwise generate tens of thousands of requests against
Redis and the maps SDK.

Mutations never retry. Automatic retry on a request that moves money is how a driver gets paid
twice; non-idempotent operations send an `Idempotency-Key` instead.

### Authorisation is by named permission

`src/shared/auth/permissions.ts` checks individual permissions such as `payout.release`, even
though the MVP has a single Super Admin role holding the `*` wildcard. Adding a Finance or
Support role later becomes a configuration change rather than an edit to every guard.

Client-side checks decide only what to render. The server enforces the same permission on every
request, so a hidden button is a courtesy, not a control.

### Every data view has four states

`QueryBoundary` renders loading, error, empty or success and never a half-drawn panel. It keeps
showing data during background refetches, because flashing a skeleton every ten seconds on the
live map is worse than a briefly stale number.

### Sessions live in an httpOnly cookie

Nothing reads or writes a token. `credentials: 'include'` on every request; the current user
comes from `GET /v1/auth/me`. An ESLint rule blocks `localStorage` so a session cannot drift
into a place that cross-site scripting could read.

### One sign-in page, and the account picks the product

`LoginPage` in `shared/auth` is the whole of sign-in for all three audiences, mounted once at
`/login`. There were three of them, one per portal, differing only in marketing copy — which
meant a driver who opened `/login` was made to guess, and punished for guessing wrong. There is
one credentials endpoint and the account carries its own audience, so the destination was never
the user's to choose. The copy is audience-neutral for the same reason: the page cannot know who
is reading it.

Two things follow, and both are easy to get wrong:

**Redirect from the login response, not from `useAuth`.** `AuthProvider` keys its session query
by the portal it reads off the URL, and the URL is `/login` for everybody. `cacheSessionUser`
writes under the *account's* audience, so an admin signing in at `/login` caches under
`['auth','me','admin']` while the provider watches `['auth','me','advertiser']`. Waiting on
`isAuthenticated` there waits forever: the sign-in succeeds and the page just sits. `LoginPage`
therefore keeps the user from the response in local state and navigates from that. Covered by
`LoginPage.test.tsx`.

**The mock reads the audience off the address.** `mockFetch` used to read it off the path, which
one URL can no longer supply.

Whether a second factor is required is the server's decision, not the page's. Admin TOTP is
mandatory (ADM-001) — these are the accounts that approve kilometres and release payouts — and
advertiser TOTP is optional, and the login response says which. The same form covers both without
knowing who signed in.

Sign-in is a split layout: a dark brand panel carrying the map, and a plain white column for the
form. A centred card over a full-page map was tried first and abandoned — the routes had to thread
around the card and ended up competing with it. Below `lg` the panel is dropped entirely and the
mark moves above the form.

That layout is `AuthLayout`, not part of `LoginPage`, because the set-password page below is the
other half of a customer's first two minutes with the product. A page that asks for a password and
does not look like the page that will later ask for it reads as phishing, which is exactly the
instinct we want customers to keep.

`AuthArtwork` is the map on that panel, with a vehicle driving each route. It owns the path
strings and passes each to CSS as `--route`, so `offset-path` and the drawn trail cannot drift
apart — change a curve in one place. The two routes are held out of phase by a negative
`animation-delay` so the panel is never completely still.

The scrim behind the panel copy covers the lower half only. Stretched over the whole panel it
dimmed the map itself and turned the white vehicles grey.

The global `prefers-reduced-motion` rule stops all of it, which is why the vehicles' resting
`offset-distance` is 18% rather than 0%: parked at 0% they sit on the start pins and each pair
reads as one smudged shape.

Google sign-in appears on the advertiser portal only. Staff access should not depend on an
external identity provider, and it is a plain link rather than a fetch because the OAuth handshake
is a browser redirect out to the provider and back to a callback that sets the session cookie.

Failed sign-ins get one message for both a wrong username and a wrong password. Telling someone
which half was wrong tells an attacker which usernames are worth spending guesses on, so
`credentialsSchema` validates shape only — length and no whitespace — and never format or
existence.

#### Reaching the sign-in screen while the mock is on

The mock holds a real session rather than reporting everyone as permanently signed in, and it
**boots signed out** — the app opens on the login screen exactly as it does against the backend.
It used to boot signed in, on the reasoning that the usual reason to run the mock is to look at a
page without a backend; that was the wrong trade, because it meant the one flow nobody could
review in mock mode was the first one every user sees.

Sign-in is persisted in `sessionStorage`, so a reload keeps you in and closing the tab signs you
out. That mimics the cookie it stands in for, and it stops a page refresh mid-review from
throwing you back to the login screen.

| Input | Result |
| --- | --- |
| `priya@abcadvertising.in` | Signed in as an advertiser |
| `rahul@movead.in` | Signed in as an admin |
| `rahul.kumar@example.com` | Signed in as a driver |
| Any other address | Signed in as whichever portal you are reviewing |
| Password `wrong` | 401, so the failure state is reviewable |
| Second factor `123456` | Accepted (admin accounts only, and only when the step is asked for) |
| Any other code | 401 |

The mock reads the audience off the **address**, not the URL, because there is
one sign-in page and it cannot tell you apart otherwise. That is also how the
real API has always decided it. Note that `/v1/auth/*` goes to the live backend
even with the mock on, so these fixture accounts only apply to the unit tests
and to a fully mocked build.

Whether the admin mock asks for a second factor at all is `VITE_ADMIN_MFA_REQUIRED`, which
mirrors `ADMIN_MFA_REQUIRED` in the backend so the two modes agree. `.env.local` has it off,
matching local development. **Only the mock reads it** — against the real API the step appears
because the server's login response asked for it, never because the client decided to.

### Onboarding an advertiser spans both portals

An advertiser account is created by operations — there is no self-registration — but **nobody at
MoveAd ever chooses the customer's password.** `OnboardAdvertiserDialog` collects the organisation
and one contact and sends both in a single `POST /v1/admin/advertisers`; the server creates the
account, an `INVITED` user, and emails that person a single-use link.

**Edit advertiser** on the row menu corrects the company afterwards, and sends only the fields
that actually changed — reopening a row and saving it untouched would otherwise write an audit
entry claiming a correction nobody made. The contact is displayed in that dialog but not editable:
their address is how they sign in and where their invitation went, so changing it is a security
decision rather than a spelling fix, and it needs an operation of its own.

The Advertisers table gives access its own column rather than folding it into the advertiser's
status. They answer different questions — "has this customer managed to get in" and "is their
wallet funded" — and an operator chasing a stalled onboarding is only asking the first. A row whose
contact has not signed up yet offers **Resend invitation**, behind a confirmation, because
resending voids the link they may be holding at that moment.

`/invitation/:token` in the advertiser portal is where that link lands, and it sits **outside
`RequireAuth`**. Whoever follows an invitation has no password by definition, so a guard would
bounce them to a sign-in page they cannot use. After setting a password the page signs them in with
it through the ordinary login route, rather than the accept response handing back a session — a
public, unauthenticated endpoint that mints sessions is a bigger thing to get right than one that
sets a password.

Each way a link can be dead gets its own message, because the recovery differs: an expired link
means ask for a new one, a used one means you already did this and should sign in, and a
superseded one means look for a more recent email. "Invalid link" would send all three to support.

The mock seeds `/invitation/demo` and `/invitation/expired`, since the page is otherwise
unreachable without intercepting an email the mock never sends.

---

## Keeping the API contract in sync

Backend and frontend are separate repositories, so the contract has to be pulled rather than
imported:

```bash
npm run api:sync    # fetch openapi.json, then generate src/shared/api/schema.d.ts
```

The backend derives `openapi.json` from its Zod schemas, making it the single source of truth.
The generated types are committed; `openapi.json` is not. **Run `npm run api:sync` in CI and
fail the build on a diff** — that check is the only thing standing between you and two
repositories that quietly disagree about a field name.

Until the backend exists, the response shapes are hand-written in `src/shared/api/hooks.ts`.
Replace them with the generated types as soon as you can.

---

## Design system

The UI follows the approved dashboard design in `assets/advertiser-dashboard.png`: a dark navy
sidebar with an indigo active pill, a light lavender canvas, and white cards with a soft shadow
and no border.

Tailwind v4, configured in CSS via `@theme` in `src/styles/index.css` — there is no
`tailwind.config.js`. Each portal builds with its own Vite root, so `index.css` declares
`@source '../**/*.{ts,tsx,html}'` explicitly; without it Tailwind only scans the one portal
directory and silently drops every class used in `src/shared`.

| Token group | Used for |
| --- | --- |
| `brand-*` | Indigo accent: active nav, primary buttons, chart series |
| `sidebar` (`#0b1b32`), `sidebar-hover` | Navigation chrome; nav labels are white |
| `canvas` | Page background |
| `zone-*` | Prime / Secondary / Network / Rejected |
| `chart-1…6` | Categorical series, mirrored in `ui/charts/palette.ts` for SVG |
| `shadow-card`, `shadow-card-hover`, `shadow-panel` | Card and floating-panel elevation |

Zone colours are **semantic**. Prime, Secondary and Network must look the same on every screen
and in the driver app, because they are what the advertiser is billed on. Use `ZoneBadge` and
`ZoneBreakdownBar` rather than restyling per page.

### Type scale

Inter, self-hosted through `@fontsource-variable/inter` and imported at the top of
`index.css` — not loaded from Google Fonts, so there is no third-party request on first paint
and the font is fingerprinted by the build. Declaring Inter in `--font-sans` is not enough on its
own; without the import the browser silently falls back to Segoe UI or Roboto and every size
below renders wider than intended.

| Role | Size / weight | Role | Size / weight |
| --- | --- | --- | --- |
| Page title | 20 / 600 | Card title | 15 / 600 |
| Page subtitle | 13 / 400 | Nav item | 13 / 400 (500 active) |
| Metric value | 20 / 600 | Table header | 11 / 500 |
| Metric label | 11 / 400 | Table cell | 13 / 400 |
| Delta, caption | 11 / 600 | Badge | 11 / 500 |

Metric labels reserve two lines (`min-h`) so values stay on one baseline across a row even when
only the longest label wraps.

### Number grouping is split by kind

Money uses Indian lakh grouping (`₹1,86,420.00`); distances, counts and impressions use western
grouping (`186,420 km`). This is the convention in the design and in Indian advertising
reporting. Currency lives in `format/money.ts`, everything else in `format/units.ts`.

Numeric columns carry the `.numeric` class for tabular figures, so currency does not jitter
when a value updates. Alignment is a separate `align` prop on `TH`/`TD`: numeric columns default
to right, which reads best when amounts are compared down a column, but the dashboard panels
pass `align="left"` to follow the design. Compact money uses a non-breaking space before the
unit (`₹80.0 K`) so it cannot wrap inside a chart axis.

### Layout

`AppShell` renders the sidebar only. Each route renders its own `Page`, which supplies the top
bar (title, greeting, per-page controls such as the campaign selector and date range) and the
padded content column.

Charts are Recharts, wrapped in `ui/charts` so pages never import Recharts directly. Charts
receive numbers for geometry, but every value the user reads is passed through
`@/shared/format`.

### Interactive components are Radix Primitives

`Select`, `DropdownMenu`, `Tabs`, `Tooltip` and `Label` come from Radix Primitives, which ship
behaviour and no styling. Keyboard navigation, focus trapping, roving tabindex and the
`aria-controls` wiring are handled by the library; appearance is Tailwind, so the design above
is unaffected.

Two consequences worth knowing. Popovers render in a portal, so they are never clipped by a
card's `overflow-hidden`. And open/closed state is exposed as a `data-state` attribute, which is
why the entrance animation is a `data-[state=open]` selector in `styles/index.css` rather than an
animation plugin.

### Toasts, and when not to use one

`toast` in `ui/toast` raises a message from anywhere — it is a plain function over a small Zustand
store, not a hook, because the callers that need it most are effects and mutation callbacks, and
some of them (a redirect guard) are not in a position to hold one. `Toaster` is mounted once
inside the router in `AppProviders`, so a message raised by a guard outlives the route that
redirected away.

Four variants, named to match `Badge`'s tones: `info`, `success`, `warning`, `danger`. A failure
stays up longer than a confirmation, because a confirmation is a receipt for something the user
just watched happen and a failure has to survive being read. `duration: 0` keeps one up until
dismissed. Radix supplies the parts that are easy to get wrong: a live region screen readers
announce without stealing focus, F6 to reach the stack, and a hover that pauses the timer.

Pass a `key` for anything that can repeat — `toast.danger({ key: 'sign-in', ... })` — and the new
message replaces the old one instead of stacking three identical copies after three wrong
passwords.

**A toast is for something the user did not ask to read**: a rejected submission, a redirect they
did not expect, a background job finishing. Field validation is not that, and stays under its
field. Neither is a failed query, which owns its region of the page and should use `ErrorState`
so the retry sits where the missing content is.

---

## Forms

`ui/form` holds every input. Three rules hold across all of them.

**The message goes below the control.** Label, control, hint, error, in that order. Putting the
message below means it never reflows the label or moves the control itself as it appears, so the
field the user is typing in does not jump under the cursor. Field-level problems belong under
their own field; a failure that belongs to the submission as a whole uses `FormError` when it
sits naturally above the submit button, or a `toast` when there is no field to hang it under and
the message must survive a re-render — sign-in is the second case, since what is wrong is the
email and password *pair*.

**Validation runs on blur, then live.** `VALIDATION_MODE` in `shared/lib/formConfig.ts` sets
react-hook-form to `onTouched` with `reValidateMode: 'onChange'`. A field is not judged while it
is being filled in for the first time, only once the user leaves it, and live from then on while
they correct it. Validating from the first keystroke puts an error under a half-typed email,
which reads as the form arguing with the user.

**Rules live in a Zod schema.** A schema used by one page sits next to it; one used by both
portals lives in `shared/schemas`. `shared/schemas/campaign.ts` is the example, and it carries the
cross-field rules — an end date cannot precede a start date, and a campaign must run at least
seven days, because installation costs the same however short the campaign is. It exports two
schemas built from the same fields: `campaignSchema` for an advertiser creating their own, and
`adminCampaignSchema` for admin creating one on their behalf, which adds the owning advertiser and
the instruction record. Sharing the field definitions is what keeps AC-34.1 true — a rule added
for one route cannot silently fail to apply to the other.

These schemas mirror the server's; they do not replace it. Anything validated only in the browser
is not validated at all, so the API checks again and stays the authority.

Accessibility is wired through `useFieldIds` and `describedBy` rather than by hand. When a field
has both a hint and an error, `aria-describedby` references both, because a hint such as "In
rupees, excluding GST" is still relevant while the value is being corrected.

Money stays a string end to end. Budgets are validated with a regular expression rather than
parsed to a number, for the same reason the client never calculates money. Where two amounts have
to be compared — does this budget fit inside the advertiser's available balance — use
`compareMoney`, which scales to integers and compares as `BigInt`. `Number(a) > Number(b)` can
answer that wrongly at the boundary.

---

## Deployment

Each portal is a static bundle behind CloudFront with an SPA fallback to `index.html`:

| Portal | Build output | Suggested origin |
| --- | --- | --- |
| Advertiser | `dist/advertiser` | `app.movead.in` |
| Admin | `dist/admin` | `admin.movead.in` |

`VITE_` variables are inlined at build time and are visible in the bundle, so a build is
environment-specific and **no secret may ever be a `VITE_` variable**.

---

## What is deliberately not here

The maps SDK and a rich table library are left out. `LiveMapPanel`
draws the surrounding chrome — the status overlay, the zoom controls — with a placeholder where
tiles go. Mount the provider inside it and lazy-load the SDK on the tracking route only: a maps
SDK in the shared bundle is a large download for every user who never opens that page.

---

## Two open conflicts with the acceptance criteria

The design leads with things the MVP specification does not yet support. Both are implemented as
drawn, and both need a decision before this reaches production data.

**Impressions have no definition.** `MoveAd-MVP-Acceptance-Criteria.md` descopes them, but the
design makes them the headline metric and the basis of "Avg. Cost per 1K Impressions". They are
served as a reach estimate and nothing in the pricing path may depend on them. Either define how
an impression is counted, or replace these panels with verified-kilometre equivalents.

**Driver names are shown to advertisers.** "Top Performing Vehicles" displays them, which
contradicts ADV-039. Note this is *only* about the name: AC-22.4 puts the registration plate on
the advertiser's side of the line, so the vehicle column beside it is correct as drawn. Either
amend the criterion for the name too, or drop that column and widen `Area`.

A third, smaller mismatch: the design's own figures imply a flat ₹1/km (₹1,86,420 spend against
186,420 km), while the authoritative rate card is tiered at ₹5 / ₹2 / ₹1. The mock fixtures use
the tiered rates and therefore show a higher spend than the mockup does. The driver sign-in
mockup states the same flat rate outright — "Earn ₹1 for every verified km" — which is wrong twice
over, since driver rates are tiered *and* lower than advertiser rates at ₹3 / ₹1.20 / ₹0.60. The
web sign-in screens borrow that layout but deliberately carry no rate in their copy.
