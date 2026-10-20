/**
 * Display-only provider family normalization for source switching.
 *
 * A family is intentionally not an identity: sourceId and bookUrl remain the
 * selection key. It is display metadata only. The drawer must keep every
 * sourceId/bookUrl candidate selectable, even when several rules share a
 * host (for example the qimao/wtzw family).
 */
export function sourceSwitchProviderFamilyKey(sourceName: string | undefined, baseUrl: string | undefined): string {
  const text = `${sourceName ?? ''} ${baseUrl ?? ''}`.trim().toLocaleLowerCase();
  if (/(七猫|奇猫|qimao|wtzw)/i.test(text)) return 'qimao';
  // A host is not a provider identity. Multiple unrelated rules can be
  // reverse-proxied through the same host, so never use it as a family key.
  // Keep a normalized source label for diagnostics and future presentation;
  // sourceId/bookUrl remain the only selection identity.
  const normalized = (sourceName ?? '').trim().replace(/[\s\-_()（）【】{}]+/g, '').toLocaleLowerCase();
  if (normalized.length > 0) return `source:${normalized}`;
  const normalizedUrl = (baseUrl ?? '').trim().toLocaleLowerCase();
  return normalizedUrl.length > 0 ? `unidentified:${normalizedUrl}` : 'unknown';
}

export function sourceSwitchProviderFamilyLabel(key: string, sourceName: string | undefined): string {
  if (key === 'qimao') return '七猫小说';
  const name = sourceName?.trim();
  return name === undefined || name.length === 0 ? key : name;
}
