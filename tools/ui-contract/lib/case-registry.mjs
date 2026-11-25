export const caseRegistryPaths = Object.freeze([
  'cases/phase-0.registry.json',
  'cases/phase-1.registry.json',
  'cases/phase-2.registry.json',
]);

export function readCaseRegistrations(read) {
  const byId = new Map();
  const issues = [];
  const byPhase = caseRegistryPaths.map((path, phase) => {
    const ids = read(path);
    if (!Array.isArray(ids)) {
      issues.push({ path, reason: 'Expected an array of case IDs.' });
      return [];
    }
    return ids.filter(id => {
      if (typeof id !== 'string' || !/^[a-z][a-z0-9.-]+$/u.test(id) || byId.has(id)) {
        issues.push({ id, path, reason: 'Invalid or duplicated registered case ID.' });
        return false;
      }
      byId.set(id, { path, phase: phase === 0 ? undefined : phase });
      return true;
    });
  });
  return { byId, byPhase, issues };
}
