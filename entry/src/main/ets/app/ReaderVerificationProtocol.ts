/**
 * Debug-only UI verification protocol. Pure data: no ArkUI, Core, Host, device
 * or user-state imports. The host runner consumes READER_VERIFY lines and the
 * real component tree from uitest dumpLayout; this file only admits one exact
 * cold-start request and shapes the observation.
 */

export const READER_VERIFY_SCHEMA = 1;
export const READER_VERIFY_STORAGE_KEY = 'readerVerifyRequest';
export const READER_VERIFY_TAG = 'ReaderVerify';

export interface ReaderVerifyRequest {
  schema: number;
  scene: string;
  widthVp: number;
  run: string;
}

export interface ReaderVerifyFontObservation {
  status: string;
  following: boolean;
  maxScale: number;
  scaleVp: number;
}

export interface ReaderVerifyFields {
  scene: string;
  requestedWidthVp: number;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  densityPixels: number;
  contentTopInsetVp: number;
  font: ReaderVerifyFontObservation;
  state: Record<string, string | number | boolean>;
}

export interface ReaderVerifyObservation extends ReaderVerifyFields {
  schema: number;
  kind: string;
  run: string;
}

const SCENE = /^[a-z][a-z0-9-]{0,31}$/;
const RUN = /^[A-Za-z0-9-]{8,64}$/;

function validScene(value: unknown): value is string {
  return typeof value === 'string' && SCENE.test(value);
}

function validRun(value: unknown): value is string {
  return typeof value === 'string' && RUN.test(value);
}

/** Exact debug admission. Any primitive true conflict leaves the normal shell. */
export function readerVerifyRequest(debug: boolean, buildModeName: string,
  scene: Object | undefined, width: Object | undefined, run: Object | undefined,
  conflicts: Array<Object | undefined> = []): ReaderVerifyRequest | undefined {
  if (debug !== true || buildModeName !== 'debug') return undefined;
  if (!validScene(scene) || !validRun(run)) return undefined;
  if (width !== '320' && width !== '366') return undefined;
  if (conflicts.some((value: Object | undefined): boolean => value === true)) return undefined;
  return { schema: READER_VERIFY_SCHEMA, scene, widthVp: width === '320' ? 320 : 366, run };
}

/** AppStorage can be stale or tampered; admit only the exact published shape. */
export function readerVerifyStoredRequest(value: Object | undefined): ReaderVerifyRequest | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'run,scene,schema,widthVp') return undefined;
  if (record.schema !== READER_VERIFY_SCHEMA) return undefined;
  if (!validScene(record.scene) || !validRun(record.run)) return undefined;
  if (record.widthVp !== 320 && record.widthVp !== 366) return undefined;
  return { schema: READER_VERIFY_SCHEMA, scene: record.scene, widthVp: record.widthVp, run: record.run };
}

export function readerVerifyObservation(request: ReaderVerifyRequest, kind: string,
  fields: ReaderVerifyFields): ReaderVerifyObservation {
  return {
    schema: READER_VERIFY_SCHEMA, kind, run: request.run,
    scene: fields.scene, requestedWidthVp: fields.requestedWidthVp,
    actualWidthVp: fields.actualWidthVp, actualHeightVp: fields.actualHeightVp,
    systemFontScale: fields.systemFontScale, densityPixels: fields.densityPixels,
    contentTopInsetVp: fields.contentTopInsetVp,
    font: fields.font, state: fields.state,
  };
}
