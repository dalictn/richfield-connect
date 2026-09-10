import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Validation for the portfolio contract.
 *
 * The client is never trusted with profile shape: every array is bounded, every
 * string is length-capped, and every year is range-checked, so a hostile client
 * cannot inflate a document or store arbitrary payloads. Extracted from
 * portfolio.ts because the field list grew past the point where inlining it
 * kept the callable readable.
 */

const MAX_ENTRIES = 20;
const MAX_SKILLS = 50;
const MIN_YEAR = 1900;
const maxYear = () => new Date().getFullYear() + 6;

export function text(value: unknown, field: string, max: number, required = false): string {
  const result = String(value ?? '').trim();
  if (required && !result) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (result.length > max) throw new HttpsError('invalid-argument', `${field} is too long.`);
  return result;
}

export function optionalUrl(value: unknown, field: string): string {
  const result = text(value, field, 500);
  if (!result) return '';
  if (!/^https?:\/\/\S+$/i.test(result)) {
    throw new HttpsError('invalid-argument', `${field} must be a full http(s) URL.`);
  }
  return result;
}

export function year(value: unknown, field: string, required = true): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpsError('invalid-argument', `${field} is required.`);
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_YEAR || parsed > maxYear()) {
    throw new HttpsError('invalid-argument', `${field} must be a year between ${MIN_YEAR} and ${maxYear()}.`);
  }
  return parsed;
}

function rows(value: unknown, field: string, max = MAX_ENTRIES): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', `${field} must be a list.`);
  if (value.length > max) throw new HttpsError('invalid-argument', `${field} may contain at most ${max} entries.`);
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new HttpsError('invalid-argument', `${field} contains an invalid entry.`);
    return item as Record<string, unknown>;
  });
}

export function stringList(value: unknown, field: string, max = MAX_SKILLS, itemMax = 80): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpsError('invalid-argument', `${field} must be a list.`);
  const cleaned = value.map((item) => text(item, field, itemMax).toLowerCase()).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, max);
}

export function qualifications(value: unknown) {
  return rows(value, 'Qualifications').map((row) => ({
    title: text(row.title, 'Qualification title', 160, true),
    institution: text(row.institution, 'Qualification institution', 160, true),
    yearCompleted: year(row.yearCompleted, 'Qualification year')!,
  }));
}

export function certifications(value: unknown) {
  return rows(value, 'Certifications').map((row) => ({
    name: text(row.name, 'Certification name', 160, true),
    issuer: text(row.issuer, 'Certification issuer', 160, true),
    year: year(row.year, 'Certification year')!,
    credentialUrl: optionalUrl(row.credentialUrl, 'Credential URL') || undefined,
  }));
}

export function workExperience(value: unknown) {
  return rows(value, 'Work experience').map((row) => ({
    company: text(row.company, 'Experience company', 160, true),
    role: text(row.role, 'Experience role', 160, true),
    startDate: text(row.startDate, 'Experience start date', 30, true),
    endDate: text(row.endDate, 'Experience end date', 30) || undefined,
    description: text(row.description, 'Experience description', 1000, true),
  }));
}

export function ventures(value: unknown) {
  return rows(value, 'Entrepreneurial experience').map((row) => ({
    name: text(row.name, 'Venture name', 160, true),
    role: text(row.role, 'Venture role', 120, true),
    description: text(row.description, 'Venture description', 1000, true),
    startYear: year(row.startYear, 'Venture start year')!,
    endYear: year(row.endYear, 'Venture end year', false),
    url: optionalUrl(row.url, 'Venture URL') || undefined,
  }));
}

export function projects(value: unknown, field: string) {
  return rows(value, field, 30).map((row) => ({
    name: text(row.name, `${field} name`, 160, true),
    url: (() => {
      const url = optionalUrl(row.url, `${field} URL`);
      if (!url) throw new HttpsError('invalid-argument', `${field} entries require a URL.`);
      return url;
    })(),
    description: text(row.description, `${field} description`, 500) || undefined,
  }));
}

export function badges(value: unknown) {
  return rows(value, 'Digital badges', 30).map((row) => ({
    name: text(row.name, 'Badge name', 160, true),
    issuer: text(row.issuer, 'Badge issuer', 160, true),
    issuedYear: year(row.issuedYear, 'Badge year', false),
    url: optionalUrl(row.url, 'Badge URL') || undefined,
  }));
}

export function achievements(value: unknown) {
  return rows(value, 'Achievements').map((row) => ({
    title: text(row.title, 'Achievement title', 200, true),
    issuer: text(row.issuer, 'Achievement issuer', 160) || undefined,
    year: year(row.year, 'Achievement year')!,
    description: text(row.description, 'Achievement description', 500) || undefined,
  }));
}

export function leadershipRoles(value: unknown) {
  return rows(value, 'Leadership roles').map((row) => ({
    role: text(row.role, 'Leadership role', 160, true),
    organisation: text(row.organisation, 'Leadership organisation', 160, true),
    startYear: year(row.startYear, 'Leadership start year')!,
    endYear: year(row.endYear, 'Leadership end year', false),
    description: text(row.description, 'Leadership description', 500) || undefined,
  }));
}

const ACTIVITY_TYPES = new Set([
  'club', 'society', 'hackathon', 'competition',
  'innovation-challenge', 'entrepreneurship-hub', 'volunteer', 'community', 'other',
]);

export function activities(value: unknown) {
  return rows(value, 'Activities', 30).map((row) => {
    const type = String(row.type ?? 'other');
    if (!ACTIVITY_TYPES.has(type)) throw new HttpsError('invalid-argument', 'Unsupported activity type.');
    return {
      name: text(row.name, 'Activity name', 160, true),
      type,
      year: year(row.year, 'Activity year', false),
      description: text(row.description, 'Activity description', 500) || undefined,
    };
  });
}
