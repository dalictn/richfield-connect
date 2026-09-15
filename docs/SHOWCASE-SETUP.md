# Showcase setup — running the demo environment

The demo runs entirely on one laptop against the **Firebase Emulator Suite**: the same code,
security rules and Cloud Functions as production, with no billing and nothing public.

Use the **most powerful laptop** on the team. On 8 GB of RAM the full emulator stack can be
killed by the OS; use the lean start command in step 4 if that happens.

---

## 1. Prerequisites (once, the night before)

| Tool | Version | Check |
|---|---|---|
| Node.js | 22 | `node -v` |
| Java (for the Auth and Firestore emulators) | 21 or newer, e.g. Temurin | `java -version` |
| Git | any | `git --version` |
| Google Chrome | current | — |

macOS: `brew install node@22 git` and `brew install --cask temurin`.

## 2. Get the code

```bash
git clone https://github.com/dalictn/richfield-connect.git   # or: git pull, if already cloned
cd richfield-connect
npm install
cd functions && npm install && cd ..
```

## 3. Configure (never commit these files)

```bash
cp functions/.env.example functions/.env
```

Create `functions/.env.local` containing the Gemini key (ask Dali for it privately):

```
AI_API_KEY=<gemini api key>
```

Then build the Cloud Functions (the emulator runs the compiled output in `functions/lib`):

```bash
cd functions && npm run build && cd ..
```

Re-run the build after pulling any backend change.

## 4. Start the demo (three terminals, in this order)

**Terminal 1 — emulators.** Wait for `All emulators ready`.

```bash
npm run emulators
# 8 GB machine? use the lean stack instead:
npx firebase emulators:start --only auth,firestore,functions --project richfield-nexus
```

**Terminal 2 — demo data.** Run once the emulators are ready.

```bash
npm run seed
```

**Terminal 3 — the app.** Wait for `compiled`, then open <http://localhost:8080>.

```bash
npm run web:emulators
```

> Use `web:emulators`, not `web` — the plain `web` script points at the live project.

| Service | Port |
|---|---|
| Web app | 8080 |
| Emulator UI (inspect data) | 4000 |
| Auth / Firestore / Functions | 9099 / 8081 / 5001 |

## 5. Demo accounts

Every account uses the password **`Richfield#2026`**.

| Role | Email | Use it for |
|---|---|---|
| Student | `thabo@my.richfield.ac.za` | Main student journey: full portfolio, AI assistant and tour, feed, messages, matches |
| Student | `aisha@my.aaa.ac.za` | Skills shared with connections only (privacy demo); not connected to Thabo |
| Alumni | `lerato.alumni@gmail.com` | Recommendation for Thabo, mentoring conversation |
| Alumni | `sipho.alumni@gmail.com` | Career pathways (AWS / Takealot), study-group post |
| Alumni | `zanele.alumni@gmail.com` | Career pathways (Yoco / Discovery), career-story post |
| Employer | `recruiter@tech-corp.co.za` | Employer dashboard, posting an opportunity |
| Administrator | `admin@richfield.ac.za` | Approvals, moderation, events, analytics, broadcasts |

**What the seed creates:** the accounts above; one pending and one live opportunity; skill-demand
data for the dashboards; a published careers fair and a draft CV clinic; Lerato's recommendation
for Thabo; 10 connections; 6 feed posts with reactions and comments; a Thabo–Lerato message
thread; and an alumni registry record (student number `RF2018001`, national ID `9501015800083`).

## 6. Pre-flight checklist (30 minutes before)

- [ ] Browser: **turn off dark mode extensions** (the app is light-themed), close other tabs,
      zoom to 100%.
- [ ] Open a **second Chrome profile** signed in as admin, so switching roles is one click.
- [ ] Do **not** click through the guided tours while testing — finishing or skipping a tour
      marks it done. (It can be replayed from the Account tab.)
- [ ] Ask the AI assistant one question as Thabo to warm the backend (the first call is slower).
- [ ] Open the deck (`docs/Richfield-Connect.pptx` or the team deck) and the demo script
      (`docs/PRESENTATION.md`).
- [ ] Have the backup screen recording ready.

## 7. Reset to a clean demo

The emulators keep data in memory, so a restart wipes everything:

1. `Ctrl+C` in Terminal 1, then start the emulators again.
2. `npm run seed` again.
3. Refresh the browser and sign in again.

Re-seeding **without** a restart restores the seeded data and the tours, but anything created
during a run (new posts, listings, messages) stays.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| "Finish account verification" screen after a restart | The browser kept an old session. Refresh; if it persists, click **Sign out** and sign in again. |
| AI assistant says it is unavailable | Check `functions/.env.local` has the key, then restart Terminal 1. The free Gemini quota resets around 09:00 SAST; the app uses `gemini-3.1-flash-lite` with `gemini-3.6-flash` as fallback. Don't rehearse AI flows over and over on the morning. |
| `Port 8080 / 9099 / 8081 / 5001 is not available` | Something is still running: `lsof -i :8080` then `kill <pid>`, or close old terminals. |
| Emulators exit on their own | Out of memory. Close other apps and use the lean start command. |
| Emulator stuck on a prompt about a parameter | `functions/.env` is missing — redo step 3. |
| `Unable to locate a Java Runtime` | Install Temurin (step 1) and open a new terminal. |
| Backend changes not showing | Rebuild functions (`cd functions && npm run build`) and restart the emulators. |
| Blank page | Wait for Terminal 3 to say `compiled`, then hard-refresh (`Cmd+Shift+R`). |

**If something fails live:** don't debug on stage. Move on to the next demo step, or switch to
the recording.

## Don'ts

- Don't run `npm run seed:production` — that writes demo accounts to the live project.
- Don't commit `functions/.env.local` or paste the API key into chats.
