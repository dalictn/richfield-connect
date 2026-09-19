# Our hackathon submission for Richfields 2026 Annual Hackathon


## Richfield Connect — Powered by GritSim AI

A cross-platform professional network for the Richfield and AAA community. Students, alumni, business recruiters and administrators share one verified network, with every role enforced on the server.

## About GritSim AI
**GritSim AI** builds institutional infrastructure for **Graduate Readiness, Industry Transition, and Talent Matching (GRIT)**. Richfield Connect closes the gap between graduates and opportunities through verified identity, portfolio profiles, AI coaching and skill-based matching.

## Team GritSim AI (Core Contributors)
- **Dali (@dalictn)**: Principal Systems Architecture, Google Gemini Integration & Admin Suite
- **Mosa (@Mosalasaa999)**: Core Runtime Scaffolding, Multi-Role RBAC & Firebase Infrastructure
- **Ina**: AI Profile Assistant Design, Career Pathway Explorer & UX Modelling
- **Lindelani (@gloriouslindelani-oss)**: 20-Field Portfolio Architecture & POPIA Compliance Framework
- **Evan (@Zenacy)**: Real-Time Communication Engine, Social Graph & Asynchronous Transcoding

## Features
- **Four roles, enforced server-side:** Firebase Auth custom claims, Firestore security rules and a check in every Cloud Function. No screen is a security boundary.
- **Student sign-up restricted to institutional email** (`@my.richfield.ac.za`, `@richfield.ac.za`, `@my.aaa.ac.za`, `@aaa.ac.za`) by a Firebase blocking function, before the account exists.
- **Alumni verification** against a private registry, with identical responses whether or not a record matches (no account enumeration), rate limiting, and email-link proof of inbox ownership.
- **Business approval gate** and **administrator accounts provisioned out-of-band**. There is no admin sign-up path.
- **Portfolio profiles** with the full brief schema, per-section audience visibility, endorsements and written recommendations.
- **Connections, a role-ranked feed, posts, reactions, comments and direct messages**, updated in real time.
- **Opportunities** behind an admin approval gate, with skill and programme matching, search and filters.
- **Institutional events** managed by administrators, with notifications targeted by programme and interests.
- **Career pathway explorer** showing where graduates of each programme ended up.
- **AI profile assistant and CV extraction** using Google Gemini, called only from Cloud Functions.
- **Three analytics dashboards** (student, business, administrator), plus an administrator console for moderation and broadcasts.
- **Real-time in-app notifications** through Firestore listeners, and push notifications through Firebase Cloud Messaging.

## Technology
| Layer | Choice |
|---|---|
| Mobile framework | React Native 0.81 (TypeScript), React Native Web for the browser build |
| UI | React Native Paper (Material Design 3) |
| Auth | Firebase Authentication with Identity Platform blocking functions, custom claims and App Check |
| Database | Cloud Firestore with security rules |
| Backend | Cloud Functions v2 (Node 22, `africa-south1`) |
| AI | Google Gemini, server-side only |
| Notifications | Firestore listeners (in-app) and Firebase Cloud Messaging (push) |
| Video | Google Cloud Transcoder |

## Running locally
Prerequisites: Node 22 and Java (for the Firestore and Auth emulators).

```bash
npm install && (cd functions && npm install && npm run build)
cp functions/.env.example functions/.env
echo 'AI_API_KEY=your-gemini-key' > functions/.env.local   # git-ignored

npm run emulators        # terminal 1: Auth, Firestore, Functions
npm run seed             # terminal 2: demo accounts and data
npm run web:emulators    # terminal 3: app on http://localhost:8080
```

Demo accounts (password `Richfield#2026`): `thabo@my.richfield.ac.za` (student), `lerato.alumni@gmail.com` (alumni), `recruiter@tech-corp.co.za` (business), `admin@richfield.ac.za` (administrator).

Deploying to Firebase, and the reasoning behind each prerequisite, is covered in [DEPLOYMENT.md](DEPLOYMENT.md). The presentation outline and demo script are in [docs/PRESENTATION.md](docs/PRESENTATION.md), and the step-by-step guide for running the showcase demo is [docs/SHOWCASE-SETUP.md](docs/SHOWCASE-SETUP.md).

## Compliance & Privacy
Built with South Africa's **Protection of Personal Information Act (POPIA)** in mind: per-section audience visibility, server-side redaction of other members' profiles, student numbers that never leave the server, a registry clients cannot read, and an audit log of administrator actions. Formal POPIA sign-off rests with Richfield's Information Officer.
