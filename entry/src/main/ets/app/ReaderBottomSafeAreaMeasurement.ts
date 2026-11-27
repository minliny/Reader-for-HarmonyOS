export type ReaderBottomSafeAreaPhase = 'stable' | 'hidden' | 'revealing';

/** Undefined denotes a failed or unsupported read, distinct from a valid empty area. */
export interface ReaderBottomAvoidAreas {
  system?: number;
  cutout?: number;
  gesture?: number;
  navigation?: number;
}

export interface ReaderBottomSafeArea {
  readonly visual: number;
  readonly interactive: number;
  readonly restored: boolean;
}

interface ReaderBottomSafeAreaRecord {
  key: string;
  areas: ReaderBottomAvoidAreas;
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

function safeBottom(areas: ReaderBottomAvoidAreas, restored: boolean): ReaderBottomSafeArea {
  const visual = Math.max(known(areas.system) ?? 0, known(areas.cutout) ?? 0);
  return { visual, interactive: Math.max(visual, known(areas.gesture) ?? 0, known(areas.navigation) ?? 0), restored };
}

/** Exactly one measured geometry per orientation, scoped to the attached window.
 * A policy ACK permits readback but cannot prove that the avoid-area bands returned. */
export class ReaderBottomSafeAreaMeasurement {
  private portrait: ReaderBottomSafeAreaRecord | undefined = undefined;
  private landscape: ReaderBottomSafeAreaRecord | undefined = undefined;

  reset(): void { this.portrait = undefined; this.landscape = undefined; }

  observe(key: string, landscape: boolean, observed: ReaderBottomAvoidAreas, phase: ReaderBottomSafeAreaPhase,
    independent: ReaderBottomAvoidAreas = {}): ReaderBottomSafeArea {
    const last = landscape ? this.landscape : this.portrait;
    const matching = last?.key === key ? last : undefined;
    const previous: ReaderBottomAvoidAreas = matching?.areas ?? {};
    const ordinaryObserved = matching?.ordinaryObserved === true;
    const ordinary: ReaderBottomAvoidAreas = {
      system: known(observed.system) ?? previous.system,
      cutout: known(observed.cutout) ?? previous.cutout,
      gesture: known(observed.gesture) ?? previous.gesture,
      navigation: known(observed.navigation) ?? previous.navigation,
    };
    let adopted = ordinary;
    let restored = phase === 'stable';
    if (!restored) {
      const held: ReaderBottomAvoidAreas = {
        system: heldArea(previous.system, observed.system, independent.system, ordinaryObserved),
        cutout: heldArea(previous.cutout, observed.cutout, independent.cutout, ordinaryObserved),
        gesture: heldArea(previous.gesture, observed.gesture, independent.gesture, ordinaryObserved),
        navigation: heldArea(previous.navigation, observed.navigation, independent.navigation, ordinaryObserved),
      };
      const expected = safeBottom(held, false);
      const live = safeBottom(observed, false);
      restored = phase === 'revealing' && live.visual >= expected.visual && live.interactive >= expected.interactive;
      if (!restored) adopted = held;
    }
    const record: ReaderBottomSafeAreaRecord = { key, areas: adopted, ordinaryObserved: restored || ordinaryObserved };
    if (landscape) this.landscape = record;
    else this.portrait = record;
    return safeBottom(adopted, restored);
  }
}
