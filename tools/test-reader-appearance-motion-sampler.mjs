import assert from 'node:assert/strict';

import {
  READER_APPEARANCE_COLLAPSE_DURATION_MS,
  READER_APPEARANCE_EXPAND_DURATION_MS,
  READER_APPEARANCE_FULL_HEIGHT,
  READER_APPEARANCE_QUICK_HEIGHT,
  READER_APPEARANCE_SHELL_TRAVEL_VP,
  readerAppearanceExpansionFromDrag,
  readerAppearanceExpansionFromTrajectory,
  readerAppearanceTrajectoryFromExpansion,
  sampleReaderAppearanceExpansion,
  sampleReaderAppearanceMotion,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

function close(actual, expected, message, tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

assert.equal(READER_APPEARANCE_EXPAND_DURATION_MS, 420);
assert.equal(READER_APPEARANCE_COLLAPSE_DURATION_MS, 360);
assert.equal(READER_APPEARANCE_QUICK_HEIGHT, 330);
assert.equal(READER_APPEARANCE_FULL_HEIGHT, 736);
assert.equal(READER_APPEARANCE_SHELL_TRAVEL_VP, 406);

// Physical expansion is the single spatial source of truth. Shell height and
// top are affine in e so a finger moving one vp always moves the top one vp.
for (const expansion of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  const frame = sampleReaderAppearanceExpansion(expansion);
  close(frame.expansionProgress, expansion, `canonical e=${expansion}`);
  close(frame.shellHeight,
    READER_APPEARANCE_QUICK_HEIGHT + READER_APPEARANCE_SHELL_TRAVEL_VP * expansion,
  `shell height at e=${expansion}`);
  close(frame.shellTranslateY,
    READER_APPEARANCE_SHELL_TRAVEL_VP * (1 - expansion),
  `shell top at e=${expansion}`);
  close(frame.shellHeight + frame.shellTranslateY, READER_APPEARANCE_FULL_HEIGHT,
    `bottom anchor at e=${expansion}`);
}

// The compatibility clocks retain authored direction/timing, while inverse
// recovery makes both land on the exact same physical expansion coordinate.
for (const profile of ['expandN', 'collapseO']) {
  let previous = readerAppearanceExpansionFromTrajectory(profile, 0);
  for (let step = 1; step <= 100; step += 1) {
    const trajectory = step / 100;
    const expansion = readerAppearanceExpansionFromTrajectory(profile, trajectory);
    if (profile === 'expandN') {
      assert.ok(expansion >= previous, 'N shell must be monotonic');
    } else {
      assert.ok(expansion <= previous, 'O shell must be monotonic');
    }
    const recovered = readerAppearanceTrajectoryFromExpansion(profile, expansion);
    close(recovered, trajectory, `${profile} inverse round trip at ${trajectory}`, 2e-5);
    previous = expansion;
  }
}

const quick = sampleReaderAppearanceExpansion(0);
const full = sampleReaderAppearanceExpansion(1);
close(quick.brightnessRail.opacity, 1, 'BrightnessRail quick opacity');
close(quick.brightnessRail.blurVp, 0, 'BrightnessRail quick blur');
close(quick.moduleNav.opacity, 1, 'ModuleNav quick opacity');
close(quick.moduleNav.blurVp, 0, 'ModuleNav quick blur');
close(full.brightnessRail.opacity, 0, 'BrightnessRail full opacity');
close(full.brightnessRail.blurVp, 12, 'BrightnessRail full blur');
close(full.brightnessRail.translateY, 15, 'BrightnessRail full y');
close(full.moduleNav.opacity, 0, 'ModuleNav full opacity');
close(full.moduleNav.blurVp, 12, 'ModuleNav full blur');
close(full.moduleNav.translateY, 20, 'ModuleNav full y');

for (const profile of ['expandN', 'collapseO']) {
  for (const expansion of [0, 0.25, 0.5, 0.75, 1]) {
    const trajectory = readerAppearanceTrajectoryFromExpansion(profile, expansion);
    const frame = sampleReaderAppearanceMotion(profile, trajectory);
    close(frame.expansionProgress, expansion, `${profile} physical e=${expansion}`);
    close(frame.shellHeight,
      READER_APPEARANCE_QUICK_HEIGHT + READER_APPEARANCE_SHELL_TRAVEL_VP * expansion,
    `${profile} shell height at e=${expansion}`);
  }
}

close(readerAppearanceExpansionFromDrag(0.25, -101.5), 0.5,
  'upward drag must expand one-to-one');
close(readerAppearanceExpansionFromDrag(0.75, 101.5), 0.5,
  'downward drag must collapse one-to-one');

console.log('reader appearance Motion V2 sampler: PASS');
