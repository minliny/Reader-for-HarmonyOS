export type RedirectMethodDecision = {
  method: string;
  keepBody: boolean;
};

export type HttpDeadlineState = 'active' | 'cancelled' | 'expired';

const CROSS_ORIGIN_SENSITIVE_HEADERS: string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'origin',
];

/** Shared 301/302/303/307/308 method/body policy used by the real Host loop. */
export function redirectMethodDecision(
  status: number,
  method: string,
  hasBody: boolean,
): RedirectMethodDecision {
  const upper = method.toUpperCase();
  const becomesGet = status === 303 && upper !== 'HEAD' ||
    (status === 301 || status === 302) && upper === 'POST';
  return becomesGet ? { method: 'GET', keepBody: false } : { method, keepBody: hasBody };
}

export function allowNextRedirect(
  followRedirects: boolean,
  maxRedirects: number,
  observedHops: number,
): boolean {
  return followRedirects && observedHops < maxRedirects;
}

export function isCrossOriginSensitiveHeader(name: string): boolean {
  return CROSS_ORIGIN_SENSITIVE_HEADERS.indexOf(name.trim().toLowerCase()) >= 0;
}

export function mergeCookieHeader(explicitCookie: string, jarCookie: string): string {
  const parts: string[] = [];
  if (explicitCookie.trim().length > 0) {
    parts.push(explicitCookie.trim());
  }
  if (jarCookie.trim().length > 0) {
    parts.push(jarCookie.trim());
  }
  return parts.join('; ');
}

export function observedCookieNames(setCookie: string[]): string[] {
  const names: string[] = [];
  for (const cookie of setCookie) {
    const separator = cookie.indexOf('=');
    if (separator > 0) {
      names.push(cookie.slice(0, separator).trim());
    }
  }
  return names;
}

export function retryBackoffMillis(
  baseMillis: number,
  attempt: number,
  maxMillis: number,
  remainingMillis: number,
): number {
  return Math.min(baseMillis * attempt, maxMillis, remainingMillis);
}

export function httpDeadlineState(
  cancelled: boolean,
  nowMillis: number,
  deadlineAtMillis: number,
): HttpDeadlineState {
  if (cancelled) {
    return 'cancelled';
  }
  return nowMillis >= deadlineAtMillis ? 'expired' : 'active';
}
