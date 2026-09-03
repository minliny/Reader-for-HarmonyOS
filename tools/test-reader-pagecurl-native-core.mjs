import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const cpp = join(root, 'entry/src/main/cpp');
const output = await mkdtemp(join(tmpdir(), 'reader-pagecurl-core-'));
try {
  const binary = join(output, 'pagecurl-core-test');
  const compile = spawnSync('c++', [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-I', cpp,
    join(cpp, 'pagecurl/pagecurl_motion.cpp'),
    join(cpp, 'pagecurl/pagecurl_engine.cpp'),
    join(cpp, 'pagecurl/pagecurl_mesh.cpp'),
    join(cpp, 'tests/pagecurl_core_test.cpp'),
    '-o', binary,
  ], { encoding: 'utf8' });
  assert.equal(compile.status, 0, `${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const abi = await readFile(join(cpp, 'pagecurl/pagecurl_c.h'), 'utf8');
  assert.match(abi, /PC_PHASE_AWAITING_HOST_COMMIT/);
  assert.match(abi, /PC_PHASE_AWAITING_HOST_PRESENT/);
  assert.match(abi, /pc_engine_host_presented/);
  assert.doesNotMatch(abi, /std::string|std::vector/,
    'the public high-frequency ABI must contain only C-compatible types');
  const engine = await readFile(join(cpp, 'pagecurl/pagecurl_engine.cpp'), 'utf8');
  assert.match(engine,
    /motion_\.UpdatePointer\(latest_pointer_\.x_normalized,[\s\S]*motion_\.BeginSettlement\([\s\S]*release\.can_commit,[\s\S]*release\.velocity_x_pages_per_second,[\s\S]*release\.velocity_y_pages_per_second,[\s\S]*0\)/,
    'release must judge the latest physical UP sample and start time from NativeVSync');
  assert.match(engine,
    /phase_ == PC_PHASE_DRAGGING[\s\S]*motion_\.UpdatePointer\(latest_pointer_\.x_normalized,[\s\S]*FillFrame/,
    'each drag VSync must render the newest physical pointer sample directly');
  assert.doesNotMatch(engine, /initial_pointer_catchup|ApproachPointer|kInitialPointerCatchUpStep/,
    'live finger input must not be delayed behind a catch-up animation');
  const motion = await readFile(join(cpp, 'pagecurl/pagecurl_motion.cpp'), 'utf8');
  assert.match(motion,
    /const Vec2 physical_down = ToCanonical\(pointer_x, pointer_y\);[\s\S]*input_origin_ = \{[\s\S]*physical_down\.x[\s\S]*physical_down\.y[\s\S]*anchor_ = \{1\.0F, input_origin_\.y\};[\s\S]*pointer_ = anchor_/,
    'one gesture must keep a stable free-edge grip at the physical DOWN height');
  assert.match(motion,
    /const Vec2 followed = \{[\s\S]*anchor_\.x \+ raw\.x - input_origin_\.x,[\s\S]*anchor_\.y \+ raw\.y - input_origin_\.y,[\s\S]*std::min\(followed\.x, anchor_\.x\)[\s\S]*std::clamp\(followed\.y, -0\.18F, 1\.18F\)/,
    'the free edge must move one-for-one with physical DOWN-to-MOVE displacement');
  assert.match(motion, /SolveGrabDistance/,
    'V2 must solve the grabbed material point');
  assert.match(motion,
    /kMaximumFingerDragProgress = 0\.75F[\s\S]*1\.0F - kMaximumFingerDragProgress[\s\S]*frame_\.crease_curvature = 0\.0F/,
    'V2 must cap raw horizontal transfer and use a straight cylindrical curl');
  assert.doesNotMatch(motion, /ProjectToBindingConstraint|BindingEdgeRemainsFlat|MaximumBindingSignedDistance/,
    'native motion must not detach from the raw finger by projecting it into a solver cone');
  assert.doesNotMatch(motion,
    /vertical_intent_violation_|kMaxVerticalToHorizontalTurnRatio|maximum_vertical_normalized/,
    'vertical finger motion must shape an admitted curl instead of cancelling it through an arbitrary cone');
  assert.match(motion, /Vec2 Hermite/,
    'V2 must use a velocity-continuous settlement path');
  assert.doesNotMatch(motion, /settlement_target_ = commit \?/,
    'settlement targets must not regress to the old fixed conditional path');
  assert.doesNotMatch(motion, /locked_corner_y|ApproachPointer/,
    'crossing the page midpoint must not switch a top-bottom corner mode');
  console.log('reader native PageCurl motion/state/ABI: PASS');
} finally {
  await rm(output, { recursive: true, force: true });
}
