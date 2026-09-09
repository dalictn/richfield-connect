/**
 * Firebase Emulator Suite wiring.
 *
 * Opting in is explicit rather than inferred from `localhost`, so a local build
 * can still be pointed at the deployed project to rehearse the real thing
 * before a demo. Web builds set the flag through webpack's DefinePlugin
 * (`npm run web:emulators`); anything else can set the global before the app
 * boots.
 *
 * Ports mirror firebase.json. Firestore is on 8081 rather than its default 8080
 * because the webpack dev server owns 8080.
 */

declare const __RICHFIELD_EMULATORS__: boolean | undefined;

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8081,
  functions: 5001,
  storage: 9199,
} as const;

export function useEmulators(): boolean {
  // Injected at build time on web. `typeof` on an undeclared identifier is safe
  // in JavaScript, so this is a no-op under Metro where it is never defined.
  if (typeof __RICHFIELD_EMULATORS__ !== 'undefined') return Boolean(__RICHFIELD_EMULATORS__);
  const runtime = globalThis as typeof globalThis & { __RICHFIELD_USE_EMULATORS__?: boolean };
  return runtime.__RICHFIELD_USE_EMULATORS__ === true;
}
