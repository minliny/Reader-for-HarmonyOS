/** Deterministic, in-memory presentation data. No Reader gateway or storage. */
export type SourceSwitchDemoMedia = 'novel' | 'manga';
export type SourceSwitchDemoProbe = 'ready' | 'retesting' | 'stale';

export interface SourceSwitchDemoSortable {
  sourceId: string;
  latencyMs: number;
  probe: SourceSwitchDemoProbe;
  arrival: number;
}

export interface SourceSwitchDemoEvent {
  atMs: number;
  sourceId: string;
  name: string;
  latest: string;
  latencyMs: number;
}

/** Only comparable, completed first-readable samples participate in ranking. */
export function compareSourceSwitchDemo(left: SourceSwitchDemoSortable,
  right: SourceSwitchDemoSortable): number {
  const leftReady = left.probe === 'ready' && Number.isFinite(left.latencyMs) && left.latencyMs > 0;
  const rightReady = right.probe === 'ready' && Number.isFinite(right.latencyMs) && right.latencyMs > 0;
  if (leftReady !== rightReady) return leftReady ? -1 : 1;
  if (leftReady && left.latencyMs !== right.latencyMs) return left.latencyMs - right.latencyMs;
  return left.arrival - right.arrival;
}

export function sourceSwitchDemoEvents(media: SourceSwitchDemoMedia, round: number): SourceSwitchDemoEvent[] {
  const names: string[] = media === 'novel' ?
    ['青山书库', '青竹阅读', '云间书屋', '拾光文学', '山海书阁', '松风阅读',
      '星河书库', '白露书屋', '南山文学', '听雨书阁', '晨光阅读', '远山书库'] :
    ['墨页漫画', '青竹漫画', '云间漫画', '拾光漫画', '山海漫画', '松风漫画',
      '星河漫画', '白露漫画', '南山漫画', '听雨漫画', '晨光漫画', '远山漫画'];
  const delays: number[] = [860, 420, 1150, 680, 330, 910, 530, 720, 440, 1050, 560, 790];
  const events: SourceSwitchDemoEvent[] = [];
  for (let index = 0; index < names.length; index += 1) {
    events.push({ atMs: 1400 + index * 650, sourceId: `${media}-${index}`, name: names[index],
      latest: media === 'novel' ? `最新 第${136 + index % 4}章 · 山河入梦` : `最新 第${82 + index % 3}话 · 风起之时`,
      latencyMs: delays[index] + (round % 2 === 0 ? (index % 3) * 55 : 0) });
  }
  // Existing identities receive fresh samples: lower latency moves the row.
  events.push({ atMs: 9700, sourceId: `${media}-0`, name: names[0],
    latest: media === 'novel' ? '最新 第136章 · 山河入梦' : '最新 第82话 · 风起之时', latencyMs: 240 });
  events.push({ atMs: 11100, sourceId: `${media}-3`, name: names[3],
    latest: media === 'novel' ? '最新 第139章 · 山河入梦' : '最新 第82话 · 风起之时', latencyMs: 190 });
  return events;
}
