/**
 * Canonical URL identity shared by reading projection, Host requests, and
 * durable offline resource keys. Fragments are not part of an HTTP request
 * target and must not split one response resource into two cache identities.
 */
export function canonicalReadingImageBaseUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const fragment = trimmed.indexOf('#');
  const canonical = fragment < 0 ? trimmed : trimmed.substring(0, fragment);
  return canonical.length > 0 ? canonical : undefined;
}
