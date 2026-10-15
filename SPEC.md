# Orva — Complete Build Specification (React Native + TypeScript + Supabase)

> Naming override: the app is named **Orva**. Murai Kanakku describes the traditional family-function notebook concept; it is not the app name.

Build a mobile app called **Orva** using **React Native (Expo) + TypeScript**, with a **local SQLite database** as the on-device source of truth and **Supabase** as the optional cloud backend (login, backup, restore, multi-device sync). Murai Kanakku describes the traditional notebook practice, not the app name.

Save this document in the repository root as `SPEC.md`.

---

## 0. How to work (instructions for Codex)

- Build **one phase at a time** (Section 16). After each phase: run typecheck, lint and tests, make a git commit, then stop and give a short summary of what works, what you assumed, and any **manual steps the owner must do**. Do not start the next phase until told.
- In Phase 0, create a short `AGENTS.md` in the repo root containing the rules in this section and a pointer to `SPEC.md`.
- Do **not** build anything in Section 17 unless told to.
- If something is ambiguous, pick the simplest option that follows Section 1 and list your assumption in the phase summary.
- Never hardcode UI text. All user-visible strings go through i18n keys.
- Keep screens thin. Business logic lives in `domain/`. Local data access lives in `db/repositories/`. Cloud code lives in `cloud/` and `services/sync/`.
- Use the sample data in Section 7 as tests and seed data. Its expected numbers are the source of truth.
- **Secrets:** never invent Supabase credentials, never commit secrets, and **never put the Supabase `service_role` key in the app**. Read `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the project's anon/publishable key) from environment variables, and commit a `.env.example`. If these variables are missing, the app must still run fully in **local-only mode** with the cloud UI disabled.
- You cannot click around the Supabase dashboard. Anything that needs the dashboard goes in the "manual steps" part of your phase summary (the full list is in Section 19).
- Test on a real device or emulator using a **development build** (`expo-dev-client`), not Expo Go, because notifications and biometrics need it.

---

## 1. Product

Murai Kanakku is a digital version of the traditional Tamil family notebook. It records how much **our household gave another family** at their functions, and how much **they gave us** at ours.

For every family it shows three things: **Total We Gave**, **Total They Gave**, and the **Difference**.

It is **not** a banking, accounting, payment, or expense app. It should feel like a simple digital family-function record book.

### Product rules

1. **Facts only.** The app shows recorded facts and the difference. It never recommends, suggests, or implies an amount. Never say "you should give", "owe", "due", or "pending".
2. **Family-based.** The relationship is between our household and another *family*, not an individual person.
3. **Offline-first and private.** Everything works with no internet and no login. Signing in is optional and only adds cloud backup and sync.
4. **Minimal typing.** Many users are older and dislike typing. Anything that can be tapped should be tapped. Only one field (family name) is ever required.

---

## 2. Terminology

UI words to use: **Family, Function, Function Record, Murai History, We Gave, They Gave, Difference, Upcoming, Invitation.**

UI words to **never** use: transaction, payment, debit, credit, owe, due, balance.

- A **FunctionRecord** is something that already happened.
- An **Invitation** is something that has not happened yet.

Keep these two separate everywhere.

---

## 3. Architecture overview

```text
React Native screens
        ↓
Hooks  →  Domain functions (balance.ts, format.ts)
        ↓
Repositories  →  Local SQLite  (source of truth for the UI, works offline)
                       ↕
              SyncService  (only when signed in)
                       ↕
        Supabase: Auth + Postgres (RLS) + one Edge Function
```

- The UI **only ever reads and writes local SQLite**. It never waits for the network.
- When the user is signed in, a background sync pushes local changes to Supabase and pulls changes made on other devices.
- Without login, the app is a complete local app.

---

## 4. Tech stack

- Expo (managed workflow, development builds) + React Native + TypeScript (strict mode)
- React Navigation (bottom tabs + native stack)
- `expo-sqlite` for local storage
- Zustand for small app state (language, lock state, settings, sync status)
- `react-hook-form` + `zod` for forms and validation
- `i18next` + `react-i18next`
- `expo-notifications` for local reminders
- `expo-local-authentication` + `expo-secure-store` for the app lock
- `expo-file-system` + `expo-sharing` for JSON backup/restore
- `expo-crypto` for UUIDs
- `date-fns` for date helpers
- `@supabase/supabase-js`, `react-native-url-polyfill`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`
- Jest for unit tests

---

## 5. Data model

Every row has a hidden `id` (a UUID generated by the app with `expo-crypto`). It is only used internally so the app can find, edit, delete and sync the right row. **No screen, form, label, search or notification ever shows, asks for, or accepts an ID.** Local field names are camelCase; cloud column names are snake_case (map them in `services/sync/mappers.ts`).

### Family

```text
id                 (hidden, internal)
familyName        required, trimmed, not empty
primaryPerson?
place?             village or town (optional, never required)
relationship?
phone?
notes?
createdAt, updatedAt, deletedAt?
```

### FunctionRecord (something that happened)

```text
id                 (hidden, internal)
familyId
date               "YYYY-MM-DD"
datePrecision      DAY | YEAR
functionType       WEDDING | ENGAGEMENT | HOUSEWARMING | BABY_FUNCTION |
                   EAR_PIERCING | PUBERTY_CEREMONY | BIRTHDAY | FUNERAL |
                   FESTIVAL | OTHER
functionName?      optional custom name
direction          WE_GAVE | THEY_GAVE
recordKind         MONEY            (GOLD and GIFT are added later)
amount             integer rupees from 0 to 9999999, required when recordKind = MONEY
addedBy?           display name of the person who entered the record, or null
notes?
createdAt, updatedAt, deletedAt?
```

For a MONEY record, amount `0` means **didn't give**. Amounts are never negative.
`addedBy` is populated automatically from the signed-in family-group member's display name; it is null when the notebook is not in a family group.

### Invitation (something coming up)

```text
id                 (hidden, internal)
familyId
functionType
functionName?
functionDate       "YYYY-MM-DD"
functionTime?      "HH:mm"
remindersEnabled   boolean
reminderOffsets    JSON array, e.g. ["7D", "1D", "MORNING_OF"]
status             UPCOMING | ATTENDED | SKIPPED
notes?
createdAt, updatedAt, deletedAt?
```

### Local-only columns (never sent to the cloud)

- On every synced local table: `isDirty INTEGER NOT NULL DEFAULT 1` (1 = has changes not yet pushed).
- On Invitation: `notificationIds` (JSON array of scheduled notification ids, used to cancel reminders).
- A local table `syncState (key TEXT PRIMARY KEY, value TEXT)` for sync cursors, `accountUserId` (the account this phone last synced with), and `lastSyncedAt`.

Add these columns from the first migration (Phase 1) so no later migration is needed.

### Soft delete

Deleting a Family, FunctionRecord or Invitation sets `deletedAt` (and `updatedAt`, `isDirty = 1`). The row is not removed. All repository queries exclude rows where `deletedAt` is set. Deleting a **Family** also soft-deletes its records and invitations; show a confirmation first that says how many records will be hidden.

### Indexes (local)

`FunctionRecord(familyId, date)`, `FunctionRecord(deletedAt)`, `Family(familyName)`, `Invitation(functionDate, status)`, `isDirty` on each synced table.

---

## 6. Rules

### Dates

- Store function dates as date-only strings (`YYYY-MM-DD`). Do **not** convert them through UTC timestamps, which causes off-by-one-day bugs. Parse by splitting the string.
- For `datePrecision = YEAR`, store `YYYY-01-01` and display **only the year** (for example `2019`). Never show "01 Jan 2019".
- For `datePrecision = DAY`, display like `03 Oct 2026`.
- Sorting: newest first by `date`, then by `createdAt`. Year-only records behave as if dated 1 Jan, so they appear at the bottom of their year group.
- `createdAt` and `updatedAt` are ISO-8601 UTC timestamps.

### Amounts

- Integer rupees from `0` through `9999999`.
- Amount `0` means "didn't give" and adds nothing to totals, but the record still counts as a function.
- Never store a negative amount. Direction decides whether it was given or received.
- Write a helper `formatINR(n)` yourself using **Indian digit grouping**: `500 → ₹500`, `5000 → ₹5,000`, `100000 → ₹1,00,000`, `12345678 → ₹1,23,45,678`. Do not rely on `Intl` behaviour on the device. Unit test it.

### Balance (calculated, never stored)

Write a pure function in `domain/balance.ts`:

```ts
calculateFamilyBalance(records: FunctionRecord[]): {
  totalGiven: number;        // sum of amount where direction = WE_GAVE
  totalReceived: number;     // sum of amount where direction = THEY_GAVE
  difference: number;        // absolute value of (totalGiven - totalReceived)
  differenceDirection: "WE_GAVE_MORE" | "THEY_GAVE_MORE" | "EQUAL";
  recordCount: number;
  theirFunctionCount: number; // records where direction = WE_GAVE
  ourFunctionCount: number;   // records where direction = THEY_GAVE
}
```

- It ignores records with `deletedAt` set and records whose `recordKind` is not `MONEY`.
- Function counts include amount-0 MONEY records; totals are unchanged by them.
- It must not import React or anything from the database or cloud layers.
- Reuse it everywhere. Never duplicate this logic in a screen.

### Difference sentences (all via i18n)

- `WE_GAVE_MORE` → "We gave ₹5,000 more"
- `THEY_GAVE_MORE` → "They gave ₹3,000 more"
- `EQUAL` (with at least one record) → "Both gave ₹10,000"
- No records → "No records yet"

Use whole-sentence translation keys with interpolation (`{{amount}}`). Do not build sentences by joining pieces, because Tamil word order is different.

### Last they gave / Last we gave

`getLastRecords(records)` returns the most recent non-deleted MONEY record in each direction using the sorting rule above. Amount-0 records are eligible. Show function label, date (respecting precision), and amount; for amount 0 show "We didn't give" or "They didn't give", never "₹0".

### Function label

If `functionName` is empty, display the translated function type (for example "Wedding"). Do **not** store a copy of the default name.

---

## 7. Sample data (seed data and test fixtures)

### Ravi Family

| Date | Precision | Function | Direction | Amount |
|---|---|---|---|---|
| 2024-10-03 | DAY | Their daughter wedding | WE_GAVE | 5000 |
| 2025-01-01 | YEAR | Our sister wedding | THEY_GAVE | 5000 |
| 2026-06-20 | DAY | Their son wedding | WE_GAVE | 10000 |
| 2026-10-03 | DAY | Our brother wedding | THEY_GAVE | 5000 |

Expected: given **₹15,000**, received **₹10,000**, difference **₹5,000**, `WE_GAVE_MORE` → "We gave ₹5,000 more".
Last they gave: Our brother wedding, 03 Oct 2026, ₹5,000.
Last we gave: Their son wedding, 20 Jun 2026, ₹10,000.
History order: 2026 (03 Oct, 20 Jun), then 2025 (shown as "2025" only), then 2024.

The test-only Mohan Family fixture (not included in sample seeding) has a 2024-03-10 Wedding with `THEY_GAVE` amount 0 and a 2025-05-04 Housewarming with `WE_GAVE` amount 2000. Its expected counts are one function in each direction; the last `THEY_GAVE` record is the 2024 wedding and represents "They didn't give".

### Kumar Family

| Date | Function | Direction | Amount |
|---|---|---|---|
| 2024-02-14 | Wedding | WE_GAVE | 5000 |
| 2025-08-02 | Baby function | THEY_GAVE | 8000 |

Expected: given ₹5,000, received ₹8,000, `THEY_GAVE_MORE` → "They gave ₹3,000 more".

### Suresh Family

| Date | Function | Direction | Amount |
|---|---|---|---|
| 2023-05-21 | Wedding | WE_GAVE | 10000 |
| 2025-01-12 | Housewarming | THEY_GAVE | 10000 |

Expected: `EQUAL` → "Both gave ₹10,000".

### Home totals with all three families

Families: 3. Function records: 8. Total given: ₹30,000. Total received: ₹28,000.

### Required unit tests for `calculateFamilyBalance`

The three families above, an empty list, a list containing a soft-deleted record (ignored), and a list containing a non-MONEY record (ignored).

---

## 8. Screens

### Navigation

Bottom tabs: **Home, Families, Add, Functions, Settings.** The **Add** tab is a visually prominent center button.

Stack screens opened on top of tabs: Family Profile, Add/Edit Family, Add/Edit Record, Add/Edit Invitation, Cloud Backup & Sync (sign-in). On the very first launch only, show the language screen (Section 11) before Home.

### Home

- Summary: number of families, number of function records, total given, total received. No charts.
- **Upcoming**: invitations that are `UPCOMING`, soonest first. Each card shows the family, function, date, and that family's We gave / They gave / Difference line, so the user sees the history before attending.
- Invitations that are still `UPCOMING` but whose date has passed show a **"Did you go?"** card with Attended / Skipped (see Section 10).
- **Recent records**: the latest function records added.
- A small, dismissible card "Back up your records" when the user is not signed in and has at least 3 records.

### Families

- Searchable list with **one search box** that matches family name, primary person, village/place, relationship and notes. Case-insensitive, instant, works offline. Searching "Salem" finds every family from Salem; searching "Ravi" finds every Ravi (also by primary person).
- **Add/Edit Family** form: only **Family name** is shown at first (required). Under a collapsed "More details" section: village/place, primary person, relationship, phone, notes. All of these are optional, so a family can be added with just a name.
- Each card: family name, village/place (small, under the name, only if entered), We gave, They gave, and the difference sentence. Showing the place also helps tell two families with the same name apart.

### Family Profile (the most important screen)

- Family name, village/place, relationship, primary person.
- Summary: We gave, They gave, Difference, difference sentence.
- **Last they gave** and **Last we gave** blocks.
- History grouped by year, newest first. Each row: date (respecting precision), function label, direction, amount. Tap a row to edit.
- Buttons: Add Record (family preselected), Add Invitation (family preselected), Edit Family.

### Functions

All function records, grouped by year, with filters: year, function type, We gave / They gave, family. A history list, not a report.

### Settings

**Language (English / தமிழ்)**, Security (PIN, biometric), Cloud Backup & Sync, Backup file (export/restore), About.

### Empty states

Friendly one-line messages with a clear action button, for example "No families yet. Add your first family."

---

## 9. Add / Edit Function Record (must be extremely fast)

Order of fields, top to bottom:

1. **Family** — pick from a list. Preselected when opened from a Family Profile. Allow "+ New family" inline, which asks for the name only.
2. **Function** — tappable chips for the function types. An optional custom name field sits underneath.
3. **Date** — defaults to today. Includes a **"Year only"** toggle for old notebook entries.
4. **Who gave?** — two large buttons: **We gave** / **They gave**. No default, so the user must choose.
5. **Amount** — a large display, quick chips (**₹500, ₹1,000, ₹2,000, ₹5,000, ₹10,000**), a **"+1" toggle** that adds ₹1 to the chosen amount, and a **"Same as last time"** chip (the previous amount for this family and direction, if any). Also a full number pad for any other amount.
6. **Notes** — optional, collapsed by default.
7. **Save** — large button.

A typical record should need **no typing at all**: family, type, amount chip, direction, save.

Validation: family and direction required; amount is a whole number from 0 to 9999999.
After save, return to the previous screen with totals already updated. Edit uses the same screen. Delete asks for confirmation.

---

## 10. Invitations and reminders

### Add Invitation

Fields: family, function type (chips), optional function name, date, optional time, reminders. Reminders default **on**: 7 days before, 1 day before, and the morning of the function (8:00 AM). The user can switch them off.

### Notifications (local, work offline)

- Use `expo-notifications` local scheduled notifications.
- Ask for notification permission when the user first saves an invitation, not at app launch. If denied, show a short note and keep working without reminders.
- Notification text contains the **family name and function only. No amounts**, because notifications appear on lock screens.
- Tapping a notification opens that family's profile.
- Editing an invitation cancels and reschedules its notifications. Deleting, attending or skipping cancels them. Store scheduled ids in the local-only `notificationIds`.
- Notification ids belong to one device. After a sync changes an invitation (Section 14), reschedule or cancel its notifications on this device.
- On Android, battery saving can delay local notifications. Test on a real device.

### Invitation → Function Record flow

1. After the function date, the invitation appears on Home as "Did you go?".
2. **Attended** opens Add Record prefilled with family, function type, function name and date. The user chooses direction and amount.
3. On save, in **one database transaction**: create the FunctionRecord and set the invitation's `status = ATTENDED`.
4. If the user leaves Add Record without saving, the invitation stays `UPCOMING`. **Never create a record before an amount is entered.**
5. **Skipped** sets `status = SKIPPED`.

---

## 11. Language (Tamil + English)

The app supports **English and Tamil**, and the user can switch between them at any time.

- **First launch:** a one-time "Choose your language" screen with two large buttons, **English** and **தமிழ்**, each written in its own language. Preselect Tamil if the phone's language is Tamil, otherwise English. The choice is saved on the device.
- **Settings → Language:** the same two options, always available. Changing the language takes effect **immediately, without restarting the app**.
- **Everything translates:** screens, buttons, messages, empty states, function types, month names (taken from the translation files, not from a date library), and notification text. When the language changes, cancel and reschedule pending reminders so their text is in the new language.
- `i18n/en.json` and `i18n/ta.json` exist from Phase 0. From then on, every new string key is added to **both** files, with a draft Tamil translation written as you go.
- Names and notes can be typed in either language using the phone's normal keyboard. Search matches the text exactly as typed (no transliteration in the MVP, so "Ravi" will not find "ரவி").
- Do not use fixed-height text boxes. Tamil script is taller than Latin script, so use minimum heights and flexible layouts.
- Core Tamil terms (from the product owner):

| English | Tamil |
|---|---|
| Family | குடும்பம் |
| Function | நிகழ்ச்சி |
| We Gave | நாம் கொடுத்தது |
| They Gave | அவர்கள் கொடுத்தது |
| Difference | வித்தியாசம் |
| History | வரலாறு |
| Upcoming | வரவிருக்கும் நிகழ்ச்சிகள் |
| Murai Kanakku | முறை கணக்கு |

Note the spelling **முறை** (with ற).

- All other Tamil strings, especially the full difference sentences, must be **reviewed by a native Tamil speaker** before release.
- Amounts always use Latin digits with the ₹ symbol and Indian grouping, in both languages.
- Test Tamil text at large system font sizes. The layout must not clip or overlap.

---

## 12. Privacy, security, lock, file backup

- No analytics, no ads, no third-party trackers.
- Without login, the app makes **no network calls**.
- **PIN lock** (4 to 6 digits) with optional **biometric** unlock. Store only a salted hash of the PIN in `expo-secure-store`, never the PIN itself. Lock the app when it goes to the background for longer than a configurable time.
- **File backup (works without login):** Settings → Backup file creates one JSON file `{ schemaVersion, exportedAt, families, records, invitations }` of non-deleted data and opens the system share sheet (WhatsApp, Drive, email, and so on).
- **File restore:** pick a backup file, validate it with `zod` and `schemaVersion`, show the counts (families, records, invitations), ask for confirmation, then replace all local data **inside one transaction** and mark every row dirty. If anything fails, nothing changes.
- **Change Request 1 compatibility:** schema version 2 includes `addedBy` and accepts amount 0. Restore accepts version 1 files without `addedBy`, normalizing that field to null. The file picker/share/transactional restore flow remains in Phase 7.
- The backup file is **not encrypted**. Show a short warning that anyone who has the file can read it.
- Notifications never include amounts.

---

> Change Request 1 replaces the schema and family-group rules in this section. The active, owner-approved source is [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql); do not apply the legacy SQL below. The Edge Function is in `supabase/functions/delete-account/`.

## 13. Supabase backend

### What it provides

- **Auth:** email one-time code (6 digits). No password to remember. Works with `signInWithOtp` and `verifyOtp`.
- **Postgres:** the cloud copy of the data, protected by Row Level Security (RLS).
- **One Edge Function:** `delete-account`.
- Everything else (screens, calculations, search) stays on the device.

### Rules

- Enable RLS on every table. Each row belongs to one signed-in user (`user_id`), and policies allow access only to that user's own rows.
- The app only ever uses the anon/publishable key plus the signed-in user's session.
- There are **no client delete policies**. The app only soft-deletes. Hard deletes happen only when an account is deleted.
- The server sets `server_updated_at` on every write. Sync pulls use this server clock, not device clocks.
- Treat `server_updated_at` as an **opaque string**. Never convert it through a JavaScript `Date`, because that loses microsecond precision.

### Migration file: `supabase/migrations/0001_init.sql`

Change Request 1 Phase D replaces this original schema with the family-group schema in that request. Do not apply the SQL below while Phase D is pending.

```sql
-- ============ Tables ============
-- Every row belongs to one signed-in user (user_id). IDs are created by the app.
create table public.families (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_name text not null check (length(btrim(family_name)) > 0),
  primary_person text,
  place text,
  relationship text,
  phone text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.function_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_id uuid not null,
  date date not null,
  date_precision text not null check (date_precision in ('DAY', 'YEAR')),
  function_type text not null check (function_type in (
    'WEDDING','ENGAGEMENT','HOUSEWARMING','BABY_FUNCTION','EAR_PIERCING',
    'PUBERTY_CEREMONY','BIRTHDAY','FUNERAL','FESTIVAL','OTHER')),
  function_name text,
  direction text not null check (direction in ('WE_GAVE', 'THEY_GAVE')),
  record_kind text not null default 'MONEY' check (record_kind in ('MONEY', 'GOLD', 'GIFT')),
  amount integer check (amount is null or amount > 0),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (family_id, user_id) references public.families(id, user_id) on delete cascade,
  constraint money_requires_amount check (record_kind <> 'MONEY' or amount is not null)
);

create table public.invitations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_id uuid not null,
  function_type text not null check (function_type in (
    'WEDDING','ENGAGEMENT','HOUSEWARMING','BABY_FUNCTION','EAR_PIERCING',
    'PUBERTY_CEREMONY','BIRTHDAY','FUNERAL','FESTIVAL','OTHER')),
  function_name text,
  function_date date not null,
  function_time time,
  reminders_enabled boolean not null default true,
  reminder_offsets jsonb not null default '["7D","1D","MORNING_OF"]'::jsonb,
  status text not null default 'UPCOMING' check (status in ('UPCOMING', 'ATTENDED', 'SKIPPED')),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  foreign key (family_id, user_id) references public.families(id, user_id) on delete cascade
);

-- ============ Last-write-wins guard + server timestamp ============
create or replace function public.sync_row_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- ignore a stale update, keep the newer existing row
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

-- ============ Row Level Security, triggers, indexes ============
grant select, insert, update on public.families, public.function_records, public.invitations to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['families', 'function_records', 'invitations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner read" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create trigger trg_sync_row_guard before insert or update on public.%I for each row execute function public.sync_row_guard()', t);
    execute format('create index %I on public.%I (user_id, server_updated_at, id)', t || '_pull_idx', t);
  end loop;
end;
$$;
```

Do not change the meaning of this SQL without telling the owner. Fixing a genuine syntax error is fine; mention it in the phase summary.

### Edge Function: `supabase/functions/delete-account/index.ts`

- Reads the caller's JWT from the `Authorization` header and verifies it with the anon client (`auth.getUser()`). Returns 401 if invalid.
- Uses the **service role key from the function's environment** (never from the app) to call `auth.admin.deleteUser(user.id)`.
- Deleting the auth user cascades to all of that user's families, records and invitations.
- Returns 200 on success. Logs no personal data.

### Client wiring (`src/cloud/`)

- `client.ts`: create the Supabase client with `react-native-url-polyfill/auto`, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`. If the env variables are missing, export `null` and make the whole cloud layer a no-op (local-only mode).
- `sessionStorage.ts`: session storage adapter. `expo-secure-store` has a small value-size limit, so use `AsyncStorage`, or the encrypted "LargeSecureStore" pattern from Supabase's Expo documentation (encryption key in SecureStore, encrypted session in AsyncStorage).
- Call `supabase.auth.startAutoRefresh()` when the app is active and `stopAutoRefresh()` when it goes to the background (AppState listener).
- `auth.ts`: `sendCode(email)` → `signInWithOtp({ email, options: { shouldCreateUser: true } })`, `verifyCode(email, token)` → `verifyOtp({ email, token, type: 'email' })`, `signOut()`, `deleteAccount()` (calls the Edge Function, then signs out).

### Cloud Backup & Sync screen (opened from Settings)

- Signed out: short explanation ("Your records will be stored securely in the cloud so you can restore them on a new phone."), an email field, **Send code**, then a 6-digit code field, **Verify**. A link to the privacy policy.
- Signed in: email shown, **Last synced** time, **Pending changes** count, **Sync now**, **Sign out**, **Delete cloud account**.
- Sign out keeps all data on this phone and just stops syncing.
- If a **different account** than the one last used on this phone signs in, follow the account rules in Section 14.
- **Delete cloud account** needs two confirmations, calls `delete-account`, then signs out. Offer "Also erase data on this phone" (off by default).

---

> Change Request 1 adds the family-group sync scope, `household_id`, group cursor resets, and member counts to this section. The current implementation is in `src/services/sync/` and `src/cloud/familyGroup.ts`.

## 14. Sync engine (`src/services/sync/`)

Files: `SyncService.ts` (interface), `NoopSyncService.ts` (local-only mode), `SupabaseSyncService.ts`, `mappers.ts` (camelCase ↔ snake_case), `merge.ts` (pure merge logic), `syncState.ts`.

### Sign-in and account rules

`syncState.accountUserId` remembers which account this phone last synced with.

- **This phone has never synced:** after sign-in, mark all local rows dirty so they upload, then pull. (This covers someone who used the app for a year before signing in.) If the account already has cloud data from another phone, both sets of data simply appear together; merging duplicate families is a later feature.
- **Same account as last time:** just sync.
- **A different account than last time:** never mix the data. Tell the user, offer to export a backup file first, then clear this phone's local data and pull the new account's data.
- Save `accountUserId` after the first successful sync.

### Sync run (single-flight: never two at once; if triggered during a run, run once more afterwards)

1. Do nothing unless the user is signed in.
2. **Push**, in this order: `families` → `function_records` → `invitations`. For each table, read dirty rows in batches of 100, map to cloud columns (leave out `isDirty` and `notificationIds`), `upsert(rows, { onConflict: 'id' })`. On success, set `isDirty = 0` **only for rows whose `updatedAt` still equals the value that was sent** (the user may have edited a row while the push was running). On error, stop, keep rows dirty, record the error.
3. **Pull**, in the same order. Fetch the signed-in user's rows (row-level security already limits them) ordered by `(server_updated_at, id)`, 500 at a time, using a **composite cursor** so rows that share a timestamp are never skipped: `server_updated_at > X OR (server_updated_at = X AND id > Y)` (PostgREST `or` filter). Save the cursor per table after each applied page.
4. **Apply** each pulled row with the pure function in `merge.ts`:
   - No local row → insert it with `isDirty = 0`.
   - Local row exists and is not dirty → overwrite with the remote row.
   - Local row exists and is dirty → keep whichever has the later `updatedAt`. **On a tie, remote wins.** If remote wins, overwrite and set `isDirty = 0`; if local wins, leave it dirty so it is pushed next.
5. After applying invitations, cancel or reschedule local notifications for changed invitations (Section 10).
6. Save `lastSyncedAt`.

### Conflict policy

Row-level **last write wins** by `updatedAt`. Records are mostly written once, so this is enough for the MVP. Device clock errors can affect this; accept the risk for now.

### When to sync

After sign-in, when the app comes to the foreground, about 3 seconds after a local write (debounced), when the network comes back (`NetInfo`), and when the user taps **Sync now**.

### Errors and status

- Never block the UI. Never show raw error text. Use short messages ("Couldn't sync. Will try again.") and retry with backoff.
- Expose a status to the UI: `idle | syncing | error | offline`, `lastSyncedAt`, and the pending dirty-row count.

### Tests

- Unit tests for `merge.ts` (every case above), `mappers.ts` (round trip), and the account rules (first sync, same account, different account).
- Sync orchestration tests using a fake Supabase client (push order, "mark clean only if unchanged", cursor paging with equal timestamps, error leaves rows dirty).

---

## 15. Architecture rules and folder structure

### Rules

- Domain logic is independent of the UI and of the cloud.
- Screens never touch the database or Supabase. They call hooks, which call repositories or services.
- Repositories are the **only** code that talks to local SQLite. They set `updatedAt` and `isDirty = 1` on every write and exclude soft-deleted rows.
- Only `services/sync/` and `cloud/` talk to Supabase.
- Use local migrations from day one. Keep a `schemaVersion`.

### Folder structure

```text
murai-kanakku/
├── SPEC.md
├── AGENTS.md
├── .env.example
├── supabase/
│   ├── migrations/0001_init.sql
│   └── functions/delete-account/index.ts
├── src/
│   ├── navigation/   RootNavigator.tsx, TabNavigator.tsx, types.ts
│   ├── screens/      Home/, Families/, FamilyProfile/, AddFamily/, AddRecord/,
│   │                 Functions/, AddInvitation/, CloudSync/, Settings/
│   ├── components/   FamilyCard, RecordItem, YearSection, BalanceSummary,
│   │                 AmountPad, AmountChips, DirectionToggle,
│   │                 FunctionTypeChips, SearchBar
│   ├── domain/       types.ts, balance.ts, family.ts, record.ts,
│   │                 invitation.ts, format.ts
│   ├── db/           client.ts, schema.ts, migrations/,
│   │                 repositories/ (familyRepository, recordRepository,
│   │                                invitationRepository)
│   ├── cloud/        client.ts, auth.ts, sessionStorage.ts
│   ├── hooks/        useFamilies, useFamilyBalance, useRecords,
│   │                 useInvitations, useSyncStatus
│   ├── services/     notifications.ts, backup.ts, security.ts,
│   │                 sync/ (SyncService.ts, NoopSyncService.ts,
│   │                        SupabaseSyncService.ts, mappers.ts,
│   │                        merge.ts, syncState.ts)
│   ├── i18n/         en.json, ta.json, index.ts
│   ├── store/        settings.ts, language.ts, lockState.ts, syncStore.ts
│   └── theme/        colors.ts, typography.ts, spacing.ts, index.ts
└── App.tsx
```

### Visual design

- Large readable text: body at least 18sp, amounts at least 28sp. Touch targets at least 48dp. Support system font scaling up to 200% without broken layouts.
- Warm, paper-like neutral palette. Mark direction with a **label and an icon, not color alone**. Do not use finance-style red/green.
- It should feel like a modern family notebook, not a banking, stock, accounting or expense app.

---

## 16. Build order

### Phase 0 — Project setup

Expo + TypeScript (strict), development build setup, folder structure, Jest, bottom-tab shell with five empty tabs, theme, i18n with `en.json` and `ta.json`, the first-launch language screen, the Settings language switch, `.env.example`, and `AGENTS.md`.
**Done when:** the app runs with five tabs, and the language can be changed between English and Tamil from the first-launch screen and from Settings, with no restart.

### Phase 1 — Domain and local database

`domain/types.ts`, `format.ts` (`formatINR`, date display with precision), `balance.ts`, SQLite schema and migrations (including `isDirty` and `syncState`), `familyRepository` and `recordRepository` (soft delete), and a dev-only "Load sample data" action using Section 7. Change Request 1 Phase A additionally allows amount 0, adds `addedBy`, directional function counts, `getLastRecords`, and migration tests that preserve rows from the previous schema.
**Done when:** all unit tests pass, including the Section 7 expected totals, the Change Request 1 Mohan fixture, and the migration-from-old-schema test; loading the sample data produces the expected numbers.

### Phase 2 — Add Family and Add Record

Add/Edit Family, Add/Edit Record (Section 9), delete with confirmation, form validation. Every new string goes into both language files (a draft Tamil translation is fine).
**Done when:** a record can be created in a few taps, edited, and deleted, and totals update immediately.

### Phase 3 — Families, Search, Family Profile, Functions, Home

Family list with search, Family Profile (summary, last they gave / last we gave, history by year), Functions tab with filters, Home summary and recent records.
**Done when:** with the sample data, searching "Ravi" and opening the profile shows exactly the expected values from Section 7.

### Phase 4 — Invitations and reminders

`invitationRepository`, Add/Edit Invitation, Upcoming on Home with each family's totals, local notifications, and the "Did you go?" → prefilled Add Record → linked record flow (Section 10).
**Done when:** an invitation set a few minutes ahead fires a notification on a real device, tapping it opens the family profile, and attending creates exactly one linked record.

### Phase 5 — Supabase backend and sign-in

`supabase/migrations/0001_init.sql` (Section 13), the `delete-account` Edge Function, `cloud/` client, session storage, email-code sign-in, and the Cloud Backup & Sync screen **without** the sync engine yet. Local-only mode must still work when env variables are missing.
**Done when:** the owner has completed the manual steps in Section 19, and can sign in with an email code on a device. Two different accounts can never read each other's rows (verify with a test script or in the Supabase SQL editor, and describe how you checked).

### Phase 6 — Sync engine

Everything in Section 14, with tests.
**Done when:** a record added on device A appears on device B after sync, an edit and a delete on one device reach the other, signing in on a new phone restores all data, working offline and syncing later works, and all sync tests pass.

### Phase 7 — Safety

PIN lock and biometric unlock, JSON file backup and restore (Section 12).
**Done when:** a backup file restores correctly onto a clean install, and a corrupted file is rejected without changing any data.

### Phase 8 — Tamil

Polish `ta.json` (the owner will have a native Tamil speaker review it), test every screen in Tamil at large font sizes, check for hardcoded strings, and check that reminders switch language when the app language changes.
**Done when:** the whole app can be used in Tamil with no clipped or missing text.

### Phase 9 — Account deletion, release readiness, real-user test

Delete cloud account flow, privacy policy link in Sign-in and About, app icon and name, error and empty states. Then let a parent or older relative try these with no help: add a family, record a function, find a family, read the history, add an invitation. Fix whatever slows them down.

---

## 17. Not in the MVP

Do **not** build yet:

- Payments, UPI, bank accounts, AI recommendations, suggested amounts, gold price calculations, chat or social features, charts, complex reports, ads.
- Later versions:
  - Voice input for names and notes.
  - FamilyMember (individual members under a family).
  - An `Event` entity for functions we host, with fast bulk entry of many records at our own function.
  - Gold and gift records (store the original values; never convert them to cash automatically).
  - Photos.
  - CSV / Excel / PDF export.
  - Importing old notebook data.
  - Sharing records with other family members (this will need a sharing layer added later).
  - Merging duplicate families.
  - Realtime updates between devices.
  - Phone-number login and Google sign-in.
  - Calendar integration.
  - End-to-end encryption of cloud data.

---

## 18. Open product decisions

Use the **default** until the product owner decides otherwise.

1. **The "+1" habit.** If families commonly give amounts like ₹501 or ₹1,001, the "+1" toggle is useful. Default: toggle available, off by default.
2. **Tiny differences.** A difference of ₹1 would show "We gave ₹1 more". Default: always show the exact difference, with no interpretation by the app.
3. **File restore behaviour.** Default: restore **replaces** local data after confirmation. Merging is a later feature.
4. **Login method.** Default: email one-time code. Phone-number login is more familiar in India but needs an SMS provider and has a per-message cost.
5. **Store listing.** Many families call the notebook "moi". Consider mentioning "moi" in the store description while keeping the app name Orva.

---

## 19. Manual setup checklist for the owner (Codex cannot do these)

1. Create a Supabase project. Choose a region close to your users (for India, Mumbai / `ap-south-1`).
2. Install the Supabase CLI. Run `supabase login`, `supabase link --project-ref <ref>`, then `supabase db push` to apply `supabase/migrations/0001_init.sql`.
3. In the dashboard, go to **Authentication → Providers → Email** and make sure it is enabled.
4. In **Authentication → Email Templates**, edit both the **Confirm signup** and **Magic Link** templates so they show the 6-digit code with `{{ .Token }}` instead of only a link.
5. Set up a **custom SMTP provider** (for example Resend) before real users arrive. Supabase's built-in email sender has a very low sending limit and is meant for testing only.
6. Run `supabase functions deploy delete-account`.
7. Copy the project URL and anon/publishable key into a local `.env` file as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never use the service role key in the app.
8. Build a development client with EAS and test on a real phone.
9. Review `docs/privacy-policy.md` and `docs/delete-account.md`, then publish both at public URLs (app stores require these links).

Note for the owner: as the project owner you can read the data in the Supabase dashboard. Data is encrypted on disk by Supabase, but it is not end-to-end encrypted. Say this plainly in the privacy policy, and treat the dashboard access as sensitive.

---

## 20. Product principle

The app provides information. It never decides family customs or tells the user what they owe.

> **"Never forget your family's Murai history again."**

Core flow: **Someone invites us → search their family → see total given, total received, difference, last time each side gave, and the full history → attend → add a function record → history updates on every device.**
