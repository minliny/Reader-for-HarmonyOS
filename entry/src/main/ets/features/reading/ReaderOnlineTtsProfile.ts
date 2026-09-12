/** Versioned Reader additions; legacy HttpTTS fields keep their import meaning. */
export type ReaderTtsAudioFormat = 'mp3' | 'wav' | 'pcm';
export type ReaderOnlineTtsProtocol = 'auto' | 'template-get' | 'openai-speech' | 'azure-speech';
export type ReaderOnlineTtsProfile = {
  version: number;
  voice: string;
  format: ReaderTtsAudioFormat;
  credentialRef?: string;
  protocol?: ReaderOnlineTtsProtocol;
  model?: string;
  credentialHeader?: string;
  credentialPrefix?: string;
  pcmSampleRate?: number;
  pcmChannels?: number;
};
export type ReaderOnlineTtsPlayback = {
  format: ReaderTtsAudioFormat;
  sampleRate?: number;
  channels?: number;
  sampleFormat: string;
  credentialRef?: string;
  credentialHeader?: string;
  credentialPrefix: string;
  rateApplied: boolean;
  ratePercent: number;
};

const MAX_PROFILE_LENGTH = 8192;
const MAX_VOICE_LENGTH = 256;
const MAX_MODEL_LENGTH = 128;
const MAX_CREDENTIAL_REF_LENGTH = 160;
const MAX_CREDENTIAL_HEADER_LENGTH = 128;
const MAX_CREDENTIAL_PREFIX_LENGTH = 256;
const PCM_SAMPLE_RATES: number[] = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
const PROFILE_KEYS: string[] = [
  'version', 'voice', 'format', 'credentialRef', 'protocol', 'model',
  'credentialHeader', 'credentialPrefix', 'pcmSampleRate', 'pcmChannels',
];

/** Opaque aliases are generated as reader.tts.<config-id>.<random-token>. */
export function isReaderTtsCredentialAliasForConfig(alias: string, configId?: number): boolean {
  if (typeof alias !== 'string' || alias.length > MAX_CREDENTIAL_REF_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(alias)) return false;
  const match = /^reader\.tts\.([0-9]+)\.([A-Za-z0-9-]{1,128})$/.exec(alias);
  if (match === null) return false;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || `${id}` !== match[1]) return false;
  return configId === undefined ? true : Number.isSafeInteger(configId) && configId >= 0 && id === configId;
}

function profileError(): Error {
  return new Error('在线语音配置格式无效');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function optionalString(
  raw: Record<string, unknown>,
  key: string,
  maxLength: number,
  options?: { allowEmpty?: boolean; pattern?: RegExp },
): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > maxLength || hasControl(value)) throw profileError();
  if (options?.allowEmpty !== true && value.length === 0) throw profileError();
  if (options?.pattern !== undefined && !options.pattern.test(value)) throw profileError();
  return value;
}

/**
 * Validate and copy the versioned profile at the Core/Host boundary.
 * Constructing a fresh object is deliberate: JSON objects containing
 * `__proto__`/unknown fields must never become executable configuration.
 */
export function readerOnlineTtsProfile(raw?: string): ReaderOnlineTtsProfile {
  if (raw === undefined || raw === '') {
    return { version: 1, voice: '', format: 'mp3', protocol: 'auto' };
  }
  if (typeof raw !== 'string' || raw.length > MAX_PROFILE_LENGTH) throw profileError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw profileError();
  }
  if (!isRecord(parsed)) throw profileError();
  for (const key of Object.keys(parsed)) {
    if (PROFILE_KEYS.indexOf(key) < 0) throw profileError();
  }

  const version = parsed['version'];
  if (version !== 1) throw profileError();
  const voice = parsed['voice'] === undefined ? '' : parsed['voice'];
  if (typeof voice !== 'string' || voice.length > MAX_VOICE_LENGTH || hasControl(voice)) throw profileError();
  const format = parsed['format'];
  if (format !== 'mp3' && format !== 'wav' && format !== 'pcm') throw profileError();

  const credentialRef = optionalString(parsed, 'credentialRef', MAX_CREDENTIAL_REF_LENGTH, {
    pattern: /^reader\.tts\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/,
  });
  const protocol = optionalString(parsed, 'protocol', 32, {
    pattern: /^(?:auto|template-get|openai-speech|azure-speech)$/,
  }) as ReaderOnlineTtsProtocol | undefined;
  const model = optionalString(parsed, 'model', MAX_MODEL_LENGTH, { allowEmpty: true });
  const credentialHeader = optionalString(parsed, 'credentialHeader', MAX_CREDENTIAL_HEADER_LENGTH, {
    pattern: /^[A-Za-z][A-Za-z0-9-]*$/,
  });
  const credentialPrefix = optionalString(parsed, 'credentialPrefix', MAX_CREDENTIAL_PREFIX_LENGTH, {
    allowEmpty: true,
  });

  const sampleRateRaw = parsed['pcmSampleRate'];
  let pcmSampleRate: number | undefined;
  if (sampleRateRaw !== undefined && sampleRateRaw !== null) {
    if (typeof sampleRateRaw !== 'number' || !Number.isSafeInteger(sampleRateRaw) ||
      PCM_SAMPLE_RATES.indexOf(sampleRateRaw) < 0) throw profileError();
    pcmSampleRate = sampleRateRaw;
  }
  const channelsRaw = parsed['pcmChannels'];
  let pcmChannels: number | undefined;
  if (channelsRaw !== undefined && channelsRaw !== null) {
    if (typeof channelsRaw !== 'number' || !Number.isSafeInteger(channelsRaw) ||
      (channelsRaw !== 1 && channelsRaw !== 2)) throw profileError();
    pcmChannels = channelsRaw;
  }

  const result: ReaderOnlineTtsProfile = { version: 1, voice, format };
  if (credentialRef !== undefined) result.credentialRef = credentialRef;
  if (protocol !== undefined) result.protocol = protocol;
  if (model !== undefined) result.model = model;
  if (credentialHeader !== undefined) result.credentialHeader = credentialHeader;
  if (credentialPrefix !== undefined) result.credentialPrefix = credentialPrefix;
  if (pcmSampleRate !== undefined) result.pcmSampleRate = pcmSampleRate;
  if (pcmChannels !== undefined) result.pcmChannels = pcmChannels;
  return result;
}
export function readerOnlineTtsEditedProfile(raw: string | undefined, voice: string, format: ReaderTtsAudioFormat): string {
  const profile = readerOnlineTtsProfile(raw);
  if (typeof voice !== 'string' || (format !== 'mp3' && format !== 'wav' && format !== 'pcm')) {
    throw profileError();
  }
  profile.voice = voice.trim(); profile.format = format;
  // Re-run the complete boundary validator after editing instead of trusting
  // a UI callback to have supplied a safe string/format.
  return JSON.stringify(readerOnlineTtsProfile(JSON.stringify(profile)));
}
export function readerTtsRateLabel(rate: number): string {
  return `${rate.toFixed(2).replace(/0$/, '')}x`;
}
