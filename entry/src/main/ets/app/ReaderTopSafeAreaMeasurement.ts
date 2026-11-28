export type ReaderTopSafeAreaPhase = 'stable' | 'hidden' | 'revealing';

/** Undefined denotes a failed or unsupported read, distinct from a valid empty area. */
export interface ReaderTopAvoidAreas {
  system?: number;
  cutout?: number;
  gesture?: number;
  navigation?: number;
}

export interface ReaderTopSafeArea {
  readonly visual: number;
  readonly interactive: number;
  readonly restored: boolean;
}

interface ReaderTopSafeAreaRecord {
  key: string;
  areas: ReaderTopAvoidAreas;
  ordinaryObserved: boolean;
}

function known(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function heldArea(previous: number | undefined, observed: number | undefined, independent: number | undefined,
  ordinaryObserved: boolean): number {
  const baseline = known(previous);
  const physical = ordinaryObserved && baseline !== undefined ? 0 : known(independent) ?? 0;
  return Math.max(baseline ?? 0, known(observed) ?? 0, physical);
}

function safeTop(areas: ReaderTopAvoidAreas, restored: boolean): ReaderTopSafeArea {
  const visual = Math.max(known(areas.system) ?? 0, known(areas.cutout) ?? 0);
  return { visual, interactive: Math.max(visual, known(areas.gesture) ?? 0, known(areas.navigation) ?? 0), restored };
}

/** Exactly one measured geometry per orientation, scoped to the attached window.
 * A policy ACK permits readback but cannot prove that the avoid-area bands returned. */
export class ReaderTopSafeAreaMeasurement {
  private portrait: ReaderTopSafeAreaRecord | undefined = undefined;
  private landscape: ReaderTopSafeAreaRecord | undefined = undefined;

  reset(): void { this.portrait = undefined; this.landscape = undefined; }

  observe(key: string, landscape: boolean, observed: ReaderTopAvoidAreas, phase: ReaderTopSafeAreaPhase,
    independent: ReaderTopAvoidAreas = {}): ReaderTopSafeArea {
    const last = landscape ? this.landscape : this.portrait;
    const matching = last?.key === key ? last : undefined;
    const previous: ReaderTopAvoidAreas = matching?.areas ?? {};
    const ordinaryObserved = matching?.ordinaryObserved === true;
    const ordinary: ReaderTopAvoidAreas = {
      system: known(observed.system) ?? previous.system,
      cutout: known(observed.cutout) ?? previous.cutout,
      gesture: known(observed.gesture) ?? previous.gesture,
      navigation: known(observed.navigation) ?? previous.navigation,
    };
    let adopted = ordinary;
    let restored = phase === 'stable';
    if (!restored) {
      const held: ReaderTopAvoidAreas = {
        system: heldArea(previous.system, observed.system, independent.system, ordinaryObserved),
        cutout: heldArea(previous.cutout, observed.cutout, independent.cutout, ordinaryObserved),
        gesture: heldArea(previous.gesture, observed.gesture, independent.gesture, ordinaryObserved),
        navigation: heldArea(previous.navigation, observed.navigation, independent.navigation, ordinaryObserved),
      };
      const expected = safeTop(held, false);
      const live = safeTop(observed, false);
      restored = phase === 'revealing' && live.visual >= expected.visual && live.interactive >= expected.interactive;
      if (!restored) adopted = held;
    }
    const record: ReaderTopSafeAreaRecord = { key, areas: adopted, ordinaryObserved: restored || ordinaryObserved };
    if (landscape) this.landscape = record;
    else this.portrait = record;
    return safeTop(adopted, restored);
  }
}
