import { installedStorageIdentity } from './storage-deployment-admission.mjs';
import { assertSameTargetBoot } from './hap-delivery-evidence.mjs';

const BUNDLE = 'io.reader.minliny';
// Destructive operation: the canonical caller supplies its explicit reset
// selection, exact target lease and verified matching signing route first.
// Official bm uninstall omits -k so the app data is removed with the bundle.
export function resetVmReaderData({ targetKind, installed, artifact, readiness,
  observeReadiness, observeInstalled, query }) {
  if (targetKind !== 'vm') throw new Error('Reader data reset is restricted to the explicitly selected VM');
  if (installed?.bundlePresent !== true || installed.bundleName !== BUNDLE)
    throw new Error('Reader data reset requires the identified installed Reader bundle');
  if (artifact?.kind !== 'signed' || artifact.signature?.status !== 'signed' || artifact.signature.verified !== true)
    throw new Error('Reader data reset requires a verified signed candidate');
  if (typeof observeReadiness !== 'function' || typeof observeInstalled !== 'function' || typeof query !== 'function')
    throw new Error('Reader data reset observation/query callbacks are required');
  assertSameTargetBoot(readiness, observeReadiness());
  if (installedStorageIdentity(observeInstalled()) !== installedStorageIdentity(installed))
    throw new Error('installed Reader identity changed before reset; uninstall refused');
  const command = `bm uninstall -n ${BUNDLE}`;
  const result = query(command);
  if (result?.status !== 0 || (result.stderr ?? '').trim() !== '' ||
      !/^uninstall bundle successfully\.?$/i.test((result.stdout ?? '').trim()))
    throw new Error('Reader uninstall did not return an unambiguous successful acknowledgement; installation stopped');
  const absent = observeInstalled();
  if (absent?.bundlePresent !== false) throw new Error('Reader bundle is still present or its absence is unproven; installation stopped');
  assertSameTargetBoot(readiness, observeReadiness());
  return { dataPolicy: 'reset', dataPreserved: false, dataReset: {
    method: 'uninstallWithoutKeepData', bundleName: BUNDLE, command,
    acknowledged: true, acknowledgement: result.stdout.trim(), bundleAbsent: true,
    evidenceBoundary: 'OS uninstall acknowledgement and bundle absence; no fresh-storage or compatibility admission is asserted',
  } };
}
