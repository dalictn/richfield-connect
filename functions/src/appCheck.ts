/**
 * App Check enforcement policy for callables.
 *
 * Every callable enforces App Check in production. The Functions emulator does
 * NOT exempt itself — firebase-functions rejects a request whose App Check
 * token is MISSING whenever `enforceAppCheck` is true, emulator or not — and
 * there is no App Check emulator to mint a token against. Hardcoding
 * `enforceAppCheck: true` therefore makes every callable unreachable in local
 * development.
 *
 * `FUNCTIONS_EMULATOR` is set to "true" by the emulator and is never set in a
 * deployed environment, so this relaxes enforcement locally and nowhere else.
 */
const IN_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

export const APP_CHECK_ENFORCEMENT = {
  enforceAppCheck: !IN_EMULATOR,
  consumeAppCheckToken: !IN_EMULATOR,
} as const;
