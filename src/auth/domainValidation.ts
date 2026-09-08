const ALLOWED_STUDENT_DOMAINS = ['@richfield.ac.za', '@aaa.ac.za'] as const;

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
    throw new Error('Student registration requires an email ending exactly in @richfield.ac.za or @aaa.ac.za.');
  }
}
