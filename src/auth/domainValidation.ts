// Must mirror functions/src/institutionalDomains.ts. The server is the boundary;
// this only keeps the user from submitting a registration that cannot succeed.
const ALLOWED_STUDENT_DOMAINS = ['@my.richfield.ac.za', '@richfield.ac.za', '@my.aaa.ac.za', '@aaa.ac.za'] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function isAllowedStudentEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return ALLOWED_STUDENT_DOMAINS.some(
    (domain) => normalized.endsWith(domain) && normalized.indexOf('@') === normalized.length - domain.length,
  );
}

export function assertAllowedStudentEmail(email: string): void {
  if (!isAllowedStudentEmail(email)) {
    throw new Error(
      `Student registration requires a Richfield or AAA institutional email ending in ${ALLOWED_STUDENT_DOMAINS.join(', ')}.`,
    );
  }
}
