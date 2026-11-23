/*
 * Copyright (C) 2018 The Android Open Source Project
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Ported from android-15.0.0_r1 SettingsLib/DisplayUtils BrightnessUtils.java.
 * Source SHA256: 7d9a706e4b4ff49ae8decef1406719ca8c6b518d652488f171a22e1800785247
 * Reader adaptations: normalized 1–100 UI coordinates, existing 0.01–1 window
 * range, continuous inverse (no integer rounding before the UI), finite guards.
 * HLG allocates finer low-setting control; it is not per-device nits calibration.
 */
const R: number = 0.5;
const A: number = 0.17883277;
const B: number = 0.28466892;
const C: number = 0.55991073;
const WINDOW_MIN: number = 0.01;

export function readerBrightnessWindowValue(percent: number): number {
  if (percent >= 100) return 1;
  if (percent <= 1) return WINDOW_MIN;
  const normalized = Math.max(0, Math.min(1, (Number.isFinite(percent) ? percent - 1 : 49) / 99));
  const ret = normalized <= R ? Math.pow(normalized / R, 2) : Math.exp((normalized - C) / A) + B;
  return WINDOW_MIN + (1 - WINDOW_MIN) * Math.max(0, Math.min(12, ret)) / 12;
}

export function readerBrightnessControlPercent(value: number): number {
  const normalized = Math.max(0, Math.min(1,
    ((Number.isFinite(value) ? value : WINDOW_MIN) - WINDOW_MIN) / (1 - WINDOW_MIN))) * 12;
  const ret = normalized <= 1 ? Math.sqrt(normalized) * R : A * Math.log(normalized - B) + C;
  return Math.max(1, Math.min(100, 1 + 99 * ret));
}

/** Public Settings brightness uses 0..255; it is not a hardware nits range. */
export function readerBrightnessSystemValue(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 255 ? value / 255 : undefined;
}
