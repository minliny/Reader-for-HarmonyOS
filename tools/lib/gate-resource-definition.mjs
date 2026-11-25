import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export function gateResourceDefinition(manifest, entry) {
  const declarations = entry.caseSelection ? manifest.files : manifest.legacy;
  return declarations?.[basename(entry.file)];
}

export function gateResourceDefinitionSha256(manifest, entry) {
  const definition = gateResourceDefinition(manifest, entry);
  if (definition === undefined) return null;
  const stable = JSON.stringify(definition, (_key, value) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
  return createHash('sha256').update(stable).digest('hex');
}
