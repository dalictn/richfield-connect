# Richfield Connect — Running and Deploying

Two ways to run the platform: the **Firebase Emulator Suite** (local, free, no
billing) and a **live deploy** to the `richfield-nexus` project. Develop and
rehearse against the emulators; deploy before the presentation.

---

## A. Local — Firebase Emulator Suite

### One-time prerequisite: Java

The Firestore and Auth emulators run on the JVM. Nothing else needs it.

```bash
brew install --cask temurin      # asks for your password
java -version                    # confirm it is on PATH
```

`brew install openjdk` also works but is keg-only, so you would have to add it to
`PATH` yourself.

### One-time prerequisite: functions/.env

Firebase Functions params (`AI_PROVIDER`, model names) are read from
`functions/.env`. Without it the emulator blocks on an interactive prompt at
startup and never finishes booting. Copy the example and adjust:

```bash
cp functions/.env.example functions/.env
```

Secrets go in `functions/.env.local` (git-ignored) — `AI_API_KEY` at minimum.
A placeholder is fine; the profile assistant and CV extraction will then fail
with an upstream auth error, and nothing else is affected.

### Run it

Three terminals:

```bash
npm run emulators        # 1. Auth, Firestore, Functions, Storage + UI on :4000
npm run seed             # 2. once the emulators are up, create the demo accounts
npm run web:emulators    # 3. the app on :8080, pointed at the emulators
```

Then open <http://localhost:8080>.

> Use `npm run web:emulators`, **not** `npm run web`. The plain `web` script
> points the client at the deployed project. Opting in is explicit so you can
> still rehearse against production from localhost.

### Seeded accounts

Every account uses the password **`Richfield#2026`**.

| Role | Email |
| --- | --- |
| Student | `thabo@my.richfield.ac.za` |
| Student | `aisha@my.aaa.ac.za` |
| Alumni | `lerato.alumni@gmail.com` |
| Business | `recruiter@tech-corp.co.za` |
| Administrator | `admin@richfield.ac.za` |

`aisha@my.aaa.ac.za` has her skills set to connections-only on purpose, so the
directory demonstrates POPIA field redaction rather than just listing everyone.

The seed also creates an `alumni_registry` record (student number **RF2018001**,
national ID `9501015800083`), one pending opportunity so the administrator
approval queue is not empty, one approved opportunity, and skill-demand rows so
the analytics dashboards have bars to draw.

### Why the emulators are the right demo target

- No Blaze plan and no billing.
- **App Check enforcement is off locally.** Note this is *not* something the
  emulator does for you — `firebase-functions` rejects any request with a
  MISSING App Check token whenever `enforceAppCheck` is true, emulator included,
  and there is no App Check emulator to mint a token against. `functions/src/appCheck.ts`
  turns enforcement off when `FUNCTIONS_EMULATOR=true`, which is never set in a
  deployed environment. Production stays fully enforced.
- The `beforeUserCreated` blocking trigger runs, so the student-domain boundary
  is genuinely demonstrable.
- No real mailbox needed: the Auth emulator prints verification and sign-in
  links to its console and UI instead of sending mail. This is the only way to
  demo the **alumni email-link flow** without controlling a real inbox.
- State resets when you stop the emulators. Re-run `npm run seed`.

---

## B. Live deploy to `richfield-nexus`

### 1. Project prerequisites (Firebase console, done once)

- [ ] **Upgrade to the Blaze plan.** Cloud Functions v2 cannot deploy on Spark.
- [ ] **Upgrade Authentication to Identity Platform.** Required for the
      `beforeUserCreated` blocking trigger. Without it, the student-domain
      boundary does not exist server-side.
- [ ] Enable **Email/Password** and **Email link (passwordless)** sign-in.
- [ ] Enable the **Cloud Transcoder API**, and grant the Functions runtime
      service account permission to create Transcoder jobs and write the storage
      bucket.
- [ ] Register a **reCAPTCHA v3** site key under App Check for the web app.
- [ ] Add your deploy domain to Authentication → Settings → Authorized domains.

### 2. Authenticate the CLI

```bash
npx firebase login
npx firebase use richfield-nexus
```

### 3. Secrets

The profile assistant and CV extraction call an LLM. Without this they return
"temporarily unavailable"; nothing else breaks.

```bash
npx firebase functions:secrets:set AI_API_KEY
```

Set the provider in `functions/.env` (not committed):

```
AI_PROVIDER=anthropic          # or openai
ANTHROPIC_MODEL=claude-sonnet-4-6
```

> The committed default is `AI_PROVIDER=openai` with model `gpt-5.6-luna`, which
> is not a real model id. Pick a provider and a current model before deploying,
> and make the README match — it currently claims Gemini 1.5 Flash, which is not
> what the code calls.

### 4. Deploy

```bash
cd functions && npm install && npm run build && cd ..
npx firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

Indexes take a few minutes to build. Do this **before** the demo, not during —
queries against a still-building index fail.

### 5. Provision an administrator

Administrators cannot self-register. This runs against the live project, so it
needs service-account credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node admin/provision-admin.mjs admin@richfield.ac.za '<12+ char password>' 'Richfield Administrator'
```

Rotate the password after first sign-in.

### 6. Build the web client with App Check

```bash
RICHFIELD_APP_CHECK_SITE_KEY=<your reCAPTCHA v3 site key> npm run web:build
```

**Without this the deployed web build cannot call anything.** All 41 callables
enforce App Check outside the emulator; a client with no App Check token is
rejected with `unauthenticated` before your code runs. The browser console says
so explicitly when the key is missing.

### 7. Seed the alumni registry

Alumni verification matches against `alumni_registry`, which is never readable
or writable by any client. Load real records out of band (console or Admin SDK)
before demoing the alumni flow, or no alumnus can verify.

---

## C. Shared live preview

A public URL anyone can open, backed by the real project. Steps 1–5 are console
and billing actions that only a project owner can perform.

```bash
# 1. Authenticate (opens a browser)
npx firebase login
npx firebase use richfield-nexus
```

**2–5, in the Firebase console (once):**

- [ ] Upgrade the project to **Blaze**. Functions v2 cannot deploy on Spark.
- [ ] Upgrade Authentication to **Identity Platform** (needed for the
      `beforeUserCreated` blocking trigger, which is the student-domain boundary).
- [ ] Enable **Email/Password** and **Email link** sign-in.
- [ ] App Check → register the **web app** with **reCAPTCHA v3**, and copy the
      site key. Without it the deployed site cannot call a single function.

```bash
# 6. Provider secret for the assistant and CV extraction
npx firebase functions:secrets:set AI_API_KEY

# 7. Build and deploy the backend
cd functions && npm install && npm run build && cd ..
npx firebase deploy --only functions,firestore:rules,firestore:indexes,storage

# 8. Build the web bundle WITH the App Check site key, then ship it
RICHFIELD_APP_CHECK_SITE_KEY=<your reCAPTCHA v3 site key> npm run web:build
npx firebase deploy --only hosting
```

The preview lands at `https://richfield-nexus.web.app`.

```bash
# 9. Demo accounts. Download a service-account key:
#    console -> Project settings -> Service accounts -> Generate new private key
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run seed:production
```

`seed:production` refuses to run if any emulator host variable is set, and
refuses without admin credentials, so it cannot redirect by accident. Override
the shared password with `SEED_PASSWORD=…` if you would rather not use the
default.

> These demo accounts are usable by anyone who finds the URL. That is fine for a
> presentation; delete them afterwards, or keep the preview unlisted.

### Preview channels

For a throwaway URL that expires rather than touching the live site:

```bash
npx firebase hosting:channel:deploy demo --expires 7d
```

Functions, Firestore and Auth are still shared with the live project — only the
static bundle is separate.

## Post-deploy smoke test

Work through these in order; each depends on the previous.

- [ ] Register a student with an `@my.richfield.ac.za` address, verify the email,
      land on onboarding.
- [ ] Register a business, confirm it is held at "pending approval".
- [ ] As administrator, approve the business; confirm it reaches the app shell.
- [ ] Business posts an opportunity → administrator publishes it from
      **Console → Opportunity approvals** → the matched student gets a push.
- [ ] Student opens **Connections → Find people**, connects to the alumnus.
- [ ] Accept the request, then confirm connections-only profile fields appear.
- [ ] Report a post, then resolve it in **Console → Moderation queue**.
- [ ] Send a role-targeted broadcast and confirm exactly one notification
      arrives per device.

## Known gaps at deploy time

These are not deployment problems — they are unbuilt features. See the
architecture notes for the full list.

- No institutional **events** (collection, functions and screens all absent).
- No **career pathway explorer**.
- No written **recommendations/testimonials** (skill endorsements exist).
- No interactive **app tutorial** (the onboarding wizard is separate).
- **Video**: uploads have no client path, and there is no Transcoder
  job-completion handler, so `videos` documents never leave `transcoding`.
- No file upload for avatars or CVs; CV intake is paste-text only, and storage
  rules deny every non-video path.
- ~11 mandated profile fields are missing (entrepreneurial experience, GitHub
  project list, deployed app URLs, digital badges, Credly, certifications,
  awards, leadership roles, societies, career interests, year of enrolment).
- `programmeOfStudy` is read by matching and analytics but only ever written by
  the emulator seed — nothing in the app sets it.
