import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as pipeline from '../scripts/hap-pipeline.mjs';

const root = mkdtempSync(join(tmpdir(), 'reader-hap-source-inputs-'));
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const commit = repo => {
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Reader Test', '-c', 'user.email=reader@example.invalid', 'commit', '-qm', 'fixture');
  assert.equal(git(repo, 'status', '--porcelain'), '');
};
try {
  const source = join(root, 'source'), outside = join(root, 'outside');
  mkdirSync(join(source, 'entry/src'), { recursive: true }); mkdirSync(outside);
  git(source, 'init', '-q');
  const external = join(outside, 'External.ets'), linked = join(source, 'entry/src/External.ets');
  writeFileSync(external, 'export const value = 1;\n'); symlinkSync(external, linked); commit(source);
  assert.match(git(source, 'ls-files', '--stage'), /^120000 /);
  // Actual production export, with clean tracked inputs, rather than regex.
  assert.throws(() => pipeline.sourceSnapshot(source), /Host build inputs.*symbolic links/);
  writeFileSync(external, 'export const value = 2;\n');
  assert.equal(git(source, 'status', '--porcelain'), '');
  assert.throws(() => pipeline.sourceSnapshot(source), /Host build inputs.*symbolic links/);
  const refused = join(root, 'refused-sandbox');
  assert.throws(() => pipeline.copySourceSandbox(source, refused), /Host build inputs.*symbolic links/);
  assert.equal(existsSync(refused), false, 'invalid input must fail before creating a sandbox');

  rmSync(linked); writeFileSync(linked, 'export const value = 3;\n'); commit(source);
  const valid = pipeline.sourceSnapshot(source), sandbox = join(root, 'sandbox');
  mkdirSync(join(source, 'entry/oh_modules/stale'), { recursive: true });
  writeFileSync(join(source, 'entry/oh_modules/stale/wrong'), 'developer dependency');
  pipeline.copySourceSandbox(source, sandbox);
  assert.equal(pipeline.sourceSnapshot(sandbox).fingerprint, valid.fingerprint);
  assert.equal(readFileSync(join(sandbox, 'entry/src/External.ets'), 'utf8'), 'export const value = 3;\n');
  assert.equal(existsSync(join(sandbox, 'entry/oh_modules')), false, 'real rsync excludes nested installed dependencies');
  writeFileSync(linked, 'export const value = 4;\n');
  assert.notEqual(pipeline.sourceSnapshot(source).fingerprint, valid.fingerprint, 'regular input changes must affect the fingerprint');
  writeFileSync(linked, 'export const value = 3;\n');
  rmSync(join(source, 'entry/oh_modules'), { recursive: true });

  // Change real input after the production snapshot, then invoke real rsync.
  // PATH injection is confined to this fixture; production has no test hook.
  const realRsync = execFileSync('/bin/sh', ['-c', 'command -v rsync'], { encoding: 'utf8' }).trim();
  const wrapperDirectory = join(root, 'wrapper'); mkdirSync(wrapperDirectory);
  const wrapper = join(wrapperDirectory, 'rsync');
  writeFileSync(wrapper, '#!/bin/sh\nprintf "export const value = 5;\\n" > "$READER_TEST_COPY_INPUT"\nexec "$READER_TEST_REAL_RSYNC" "$@"\n');
  chmodSync(wrapper, 0o755);
  const originalEnvironment = { PATH: process.env.PATH, READER_TEST_COPY_INPUT: process.env.READER_TEST_COPY_INPUT,
    READER_TEST_REAL_RSYNC: process.env.READER_TEST_REAL_RSYNC };
  const racingSandbox = join(root, 'racing-sandbox');
  try {
    process.env.PATH = `${wrapperDirectory}:${process.env.PATH}`;
    process.env.READER_TEST_COPY_INPUT = linked; process.env.READER_TEST_REAL_RSYNC = realRsync;
    assert.throws(() => pipeline.copySourceSandbox(source, racingSandbox), /source inputs during sandbox copy changed/);
    assert.equal(readFileSync(join(racingSandbox, 'entry/src/External.ets'), 'utf8'), 'export const value = 5;\n', 'the wrapper must execute real rsync');
  } finally {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    writeFileSync(linked, 'export const value = 3;\n');
  }
  const restoredSandbox = join(root, 'restored-sandbox'); pipeline.copySourceSandbox(source, restoredSandbox);
  assert.equal(pipeline.sourceSnapshot(restoredSandbox).fingerprint, valid.fingerprint, 'restored inputs must pass the real copy');

  const protectedOutside = join(root, 'protected-outside'); mkdirSync(protectedOutside);
  const sentinel = join(protectedOutside, 'preserve'); writeFileSync(sentinel, 'original outside bytes');
  const destinationLink = join(root, 'destination-link'); symlinkSync(protectedOutside, destinationLink);
  assert.throws(() => pipeline.copySourceSandbox(source, destinationLink), /sandbox destination.*symbolic links/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'original outside bytes');
  assert.equal(existsSync(join(protectedOutside, 'entry')), false, 'rsync must not write through a destination link');
  const destinationParent = join(root, 'destination-parent'); symlinkSync(protectedOutside, destinationParent);
  assert.throws(() => pipeline.copySourceSandbox(source, join(destinationParent, 'deep/new-sandbox')),
    /sandbox destination.*symbolic links/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'original outside bytes');
  assert.equal(existsSync(join(protectedOutside, 'deep')), false, 'a distant destination link must fail before creating directories');

  const originalEntry = join(root, 'original-entry');
  renameSync(join(source, 'entry'), originalEntry); symlinkSync(originalEntry, join(source, 'entry'));
  assert.throws(() => pipeline.sourceSnapshot(source), /Host build inputs.*symbolic links/,
    'a parent directory link must fail even with the same target contents');
  assert.throws(() => pipeline.copySourceSandbox(source, join(root, 'parent-sandbox')), /Host build inputs.*symbolic links/);
  rmSync(join(source, 'entry')); renameSync(originalEntry, join(source, 'entry'));
  symlinkSync(join(outside, 'absent'), join(source, 'entry/src/dangling.ets')); commit(source);
  assert.throws(() => pipeline.sourceSnapshot(source), /Host build inputs.*symbolic links/, 'dangling links must not vanish from admission');

  const controller = join(root, 'controller'); mkdirSync(join(controller, 'tools'), { recursive: true });
  git(controller, 'init', '-q');
  const externalGate = join(outside, 'gate.mjs'); writeFileSync(externalGate, 'export const gate = 1;\n');
  symlinkSync(externalGate, join(controller, 'tools/gate.mjs')); commit(controller);
  assert.throws(() => pipeline.controllerSnapshot(controller), /Host controller inputs.*symbolic links/);
  writeFileSync(externalGate, 'export const gate = 2;\n'); assert.equal(git(controller, 'status', '--porcelain'), '');
  assert.throws(() => pipeline.controllerSnapshot(controller), /Host controller inputs.*symbolic links/);
  rmSync(join(controller, 'tools/gate.mjs')); writeFileSync(join(controller, 'tools/gate.mjs'), 'export const gate = 3;\n');
  commit(controller);
  const regularController = pipeline.controllerSnapshot(controller);
  const movedTools = join(root, 'moved-tools'); renameSync(join(controller, 'tools'), movedTools);
  symlinkSync(movedTools, join(controller, 'tools'));
  assert.throws(() => pipeline.controllerSnapshot(controller), /Host controller inputs.*symbolic links/);
  rmSync(join(controller, 'tools')); renameSync(movedTools, join(controller, 'tools'));
  assert.equal(pipeline.controllerSnapshot(controller).fingerprint, regularController.fingerprint);

  const workspace = join(root, 'workspace'); mkdirSync(workspace); git(workspace, 'init', '-q');
  symlinkSync(externalGate, join(workspace, 'README.md')); commit(workspace);
  assert.throws(() => pipeline.workspaceContractSnapshot(workspace), /Workspace contract inputs.*symbolic links/);
  rmSync(join(workspace, 'README.md')); writeFileSync(join(workspace, 'README.md'), 'controlled contract\n');
  mkdirSync(join(workspace, '.agents/skills/reader-harmonyos-hap-pipeline'), { recursive: true });
  writeFileSync(join(workspace, '.agents/skills/reader-harmonyos-hap-pipeline/SKILL.md'), 'controlled skill\n'); commit(workspace);
  const regularContract = pipeline.workspaceContractSnapshot(workspace);
  const movedAgents = join(root, 'moved-agents'); renameSync(join(workspace, '.agents'), movedAgents);
  symlinkSync(movedAgents, join(workspace, '.agents'));
  assert.throws(() => pipeline.workspaceContractSnapshot(workspace), /Workspace contract inputs.*symbolic links/);
  rmSync(join(workspace, '.agents')); renameSync(movedAgents, join(workspace, '.agents'));
  assert.equal(pipeline.workspaceContractSnapshot(workspace).fingerprint, regularContract.fingerprint);
  writeFileSync(join(workspace, 'README.md'), 'changed controlled contract\n');
  assert.notEqual(pipeline.workspaceContractSnapshot(workspace).fingerprint, regularContract.fingerprint);

  // Never open a FIFO: type admission must reject it before content hashing.
  for (const [method, relativePath, label] of [
    ['sourceSnapshot', 'entry/src/nested/Input.ets', 'Host build inputs'],
    ['controllerSnapshot', 'tools/nested/gate.mjs', 'Host controller inputs'],
    ['workspaceContractSnapshot', '.agents/skills/reader-harmonyos-hap-pipeline/nested/SKILL.md', 'Workspace contract inputs'],
  ]) {
    const special = join(root, `special-${method}`), input = join(special, relativePath);
    mkdirSync(join(input, '..'), { recursive: true });
    execFileSync('mkfifo', [input]); assert.equal(lstatSync(input).isFIFO(), true);
    assert.throws(() => pipeline[method](special), new RegExp(`${label}.*regular files and directories`));
    if (method === 'sourceSnapshot') {
      const rejectedCopy = join(root, 'special-sandbox');
      assert.throws(() => pipeline.copySourceSandbox(special, rejectedCopy), /regular files and directories/);
      assert.equal(existsSync(rejectedCopy), false, 'special inputs must fail before copying');
    }
    rmSync(input); writeFileSync(input, 'regular replacement\n');
    const ordinary = pipeline[method](special);
    assert.equal(ordinary.files.some(file => file.path === relativePath && file.type === 'file'), true,
      'ordinary nested files/directories must still be accepted');
  }
  console.log('PASS HAP source/controller/workspace inputs: links and FIFO rejected before reads/copy, real sandbox copy and regular input drift');
} finally { rmSync(root, { recursive: true, force: true }); }
