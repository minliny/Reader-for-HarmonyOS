import { readFileSync } from 'node:fs';
import * as launch from '../../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import * as verification from '../../entry/src/main/ets/app/ReaderVerificationProtocol.ts';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

const source = name => readFileSync(new URL(`../../entry/src/main/ets/app/${name}.ts`, import.meta.url), 'utf8');
const eventAdmission = pureModuleProbe(source('ReaderEventLoopProbe'), 'ReaderEventLoopProbe.ts', {}, ['readerEventLoopProbeEnabled']);
const capacityAdmission = pureModuleProbe(source('ReaderCapacityProbe'), 'ReaderCapacityProbe.ts', {}, ['readerCapacityProbeEnabled']);
const appStorage = () => {
  const values = new Map();
  return { values, setOrCreate: (key, value) => values.set(key, value), delete: key => values.delete(key),
    get: key => values.get(key) };
};

/** Feature fixture, not a platform emulator. The caller supplies every selected
 * probe/IO/log port. Admission and composition execute the actual production
 * module and its actual cold parsers; no entry or recovery algorithm is copied. */
export function productionEntryDiagnostics(ports) {
  return pureModuleProbe(source('ReaderEntryDiagnostics'), 'ReaderEntryDiagnostics.ts',
    { ...launch, ...verification, ...eventAdmission, ...capacityAdmission, AppStorage: appStorage(), ...ports },
    ['ReaderEntryDiagnostics']).ReaderEntryDiagnostics;
}

/** Actual ordinary-entry publication defaults for focused Ability fixtures. */
export function entryStartupPublicationInputs() {
  const common = name => readFileSync(new URL(`../../entry/src/main/ets/features/common/${name}`, import.meta.url), 'utf8');
  return { ...pureModuleProbe(common('ReaderTransientFeedback.ts'), 'ReaderTransientFeedback.ts', {},
    ['READER_TRANSIENT_TOAST_STORAGE_KEY', 'READER_TRANSIENT_HOST_STORAGE_KEY', 'createReaderTransientToastState']),
    ...pureModuleProbe(common('ReaderMotionPolicy.ets'), 'ReaderMotionPolicy.ets', {}, ['READER_REDUCE_MOTION_STORAGE_KEY']) };
}
