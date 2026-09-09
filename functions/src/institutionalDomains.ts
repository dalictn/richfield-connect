/**
 * Single source of truth for the Richfield/AAA institutional student domains.
 *
 * The blocking trigger and the registration callables must agree exactly. When
 * these lists were duplicated they drifted, and the stricter of the two silently
 * became the real boundary. Import from here rather than re-declaring.
 */
export const STUDENT_DOMAINS = [
  '@my.richfield.ac.za',
  '@richfield.ac.za',
  '@my.aaa.ac.za',
  '@aaa.ac.za',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Matches the domain exactly. `student@evil-richfield.ac.za` and
 * `student@richfield.ac.za.attacker.com` are both rejected because the `@` must
 * sit immediately before the domain suffix.
 */
export function isStudentEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return STUDENT_DOMAINS.some(
    (domain) => normalized.endsWith(domain) && normalized.indexOf('@') === normalized.length - domain.length,
  );
}
