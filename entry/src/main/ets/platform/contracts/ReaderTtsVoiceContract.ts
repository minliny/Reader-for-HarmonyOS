export type ReaderTtsVoiceOption = {
  language: string;
  person: number;
  label: string;
};

/**
 * Newer system images report downloadable catalogue entries alongside voices
 * that can be created immediately. Only the latter may enter persisted Reader
 * choices; older images omit status, so an absent value remains compatible.
 */
export function isReaderTtsVoiceInstalled(status: string | undefined): boolean {
  if (status === undefined || status.trim().length === 0) return true;
  return status.trim().toUpperCase() === 'INSTALLED';
}
