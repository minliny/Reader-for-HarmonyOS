import type { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';

const LOG_DOMAIN = 0x5244;
const DEFAULT_VISUAL_SCENARIO = 'default';

let activeScenario = DEFAULT_VISUAL_SCENARIO;

/**
 * Reads the launch intent once, before ReaderRuntimeOwner.install().
 * `--ps visualScenario <name>` selects a scenario map; the special value
 * `off` releases the real Core runtime (comparison escape hatch).
 */
export function installVisualScenario(want: Want | undefined): void {
  const requested = want?.parameters?.['visualScenario'];
  if (typeof requested === 'string' && requested.length > 0) {
    activeScenario = requested;
  } else {
    activeScenario = DEFAULT_VISUAL_SCENARIO;
  }
  hilog.info(LOG_DOMAIN, 'Reader', 'Visual-test scenario: %{public}s', activeScenario);
}

export function visualScenarioName(): string {
  return activeScenario;
}

/** True while every Core command is answered from fixtures instead of NAPI. */
export function visualModeActive(): boolean {
  return activeScenario !== 'off';
}

/**
 * One fixture rule, in any of three shapes:
 * - plain data object (always answers with `data`),
 * - `{ match: {...}, data: {...} }` (answers only when every match key
 *   equals the corresponding request param; arrays admit any listed value),
 * - `{ __error__: { code, message } }` (rejects, surfacing the page error
 *   state on purpose).
 * A method may map to an array of rules (first match wins).
 */
export type VisualFixtureRule = JsonObject;

export interface VisualScenarioEntry {
  method: string;
  rule: VisualFixtureRule;
}

export interface VisualFixtureError {
  code: string;
  message: string;
}
