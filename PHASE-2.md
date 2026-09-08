# Richfield Connect — Phase 2

Phase 2 adds the professional portfolio architecture, contextual AI profile assistant, structured onboarding, profile completeness evaluation, skill endorsements, field-level visibility, and NLP-assisted CV extraction. No Phase 3 social graph, messaging, feeds, or video processing is included.

## Included

- Canonical `PortfolioProfile` TypeScript domain schema.
- Four visibility levels per protected profile section: `public`, `connections`, `private`.
- Server-side portfolio validation through `upsertPortfolioProfile`.
- Real-time profile consumption retained through the Phase 1 `onSnapshot` provider.
- Four-step first-login onboarding wizard.
- AI-backed contextual profile assistant using either OpenAI or Anthropic through Firebase callable functions.
- Profile completeness evaluator with actionable missing-field suggestions.
- Server-side skill endorsement validation and duplicate protection.
- Server-side `getVisibleProfile` redaction boundary. `connections` access checks for a future Phase 3 `connections/{uid}/members/{viewerUid}` record without exposing private fields directly to clients.
- NLP CV extraction into structured headline, summary, skills, qualifications and experience JSON.
- SHA-256 source hash retained for extraction traceability; raw CV text is not persisted by the extraction function.

## AI configuration

Set Firebase Functions parameters/secrets before deployment:

```powershell
firebase functions:secrets:set AI_API_KEY
```

Choose the provider:

```powershell
firebase functions:config:set richfield.ai_provider="openai"
```

For Firebase Functions v2 parameterised configuration, configure the following values in `functions/.env` (do not commit secrets):

- `AI_PROVIDER=openai` or `anthropic`
- `OPENAI_MODEL` (default `gpt-5.6-luna`)
- `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`)

The single `AI_API_KEY` secret must belong to the selected provider. API keys are never shipped to the mobile application.

## Deploy

```powershell
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## Phase boundary

Not implemented in Phase 2:

- social connections and feeds
- direct messaging
- video transcoding
- opportunity matching
- FCM notifications
- analytics dashboards
- full administrator panel

Those belong to later phases in the approved roadmap.
