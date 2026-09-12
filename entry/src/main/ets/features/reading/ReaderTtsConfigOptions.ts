import type { ReaderTtsVoiceOption } from './ReaderTtsPreferencesState';

export type ReaderTtsConfigField = 'voice' | 'engine' | 'language' | 'session' | 'failure';
export interface ReaderTtsConfigChoice { id: string; label: string; }
export interface ReaderTtsNamedEngine { id: number; name: string; }

export function readerTtsVoiceId(voice: ReaderTtsVoiceOption): string {
  return `voice:${voice.language}:${voice.person}`;
}

export function readerTtsLanguageLabel(language: string): string {
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized === 'zh-cn') return '普通话';
  if (normalized === 'zh-hk') return '粤语';
  if (normalized === 'zh-tw') return '中文（台湾）';
  if (normalized === 'en-us') return '英语（美国）';
  if (normalized === 'en-gb') return '英语（英国）';
  return language;
}

export function readerTtsConfigChoices(field: ReaderTtsConfigField, engine: string,
  engines: ReaderTtsNamedEngine[], voices: ReaderTtsVoiceOption[]): ReaderTtsConfigChoice[] {
  if (field === 'engine') return [{ id: 'system', label: '系统 TTS' },
    ...engines.map((item: ReaderTtsNamedEngine): ReaderTtsConfigChoice =>
      ({ id: `http-tts:${item.id}`, label: `在线 · ${item.name}` }))];
  if (field === 'session') return [{ id: 'exclusive', label: '语音播放（暂停其他音频）' },
    { id: 'mix', label: '混音播放（同时播放）' }];
  if (field === 'failure') return [{ id: 'stop', label: '停止并提示' }, { id: 'skip', label: '跳过不可用内容' }];
  if (engine.startsWith('http-tts:')) return [];
  const result: ReaderTtsConfigChoice[] = [];
  for (const voice of voices) {
    const id = field === 'language' ? voice.language : readerTtsVoiceId(voice);
    if (result.some((item: ReaderTtsConfigChoice): boolean => item.id === id)) continue;
    const label = field === 'language' ? readerTtsLanguageLabel(voice.language) :
      `${voice.label} · ${readerTtsLanguageLabel(voice.language)}`;
    result.push({ id, label });
  }
  return result;
}
