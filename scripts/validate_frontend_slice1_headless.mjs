#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outDir = path.join(repoRoot, "artifacts/frontend-slice1-headless", stamp);
const latestDir = path.join(repoRoot, "artifacts/frontend-slice1-headless/latest");

const files = {
  appShellValidator: "entry/src/main/ets/__tests__/AppShellReducerValidator.ets",
  testInfra: "entry/src/main/ets/__tests__/TestInfra.ets",
  entryAbility: "entry/src/main/ets/entryability/EntryAbility.ets",
  motionAdapter: "entry/src/main/ets/ui/adapters/MotionAdapter.ets",
  tokenAdapter: "entry/src/main/ets/ui/adapters/TokenAdapter.ets",
  stateFlow: "entry/src/main/ets/ui/shells/AppShellStateFlow.ets",
  readerReducer: "entry/src/main/ets/ui/store/ReaderReducer.ets",
  readerUiStore: "entry/src/main/ets/ui/store/ReaderUiStore.ets",
  motionContract: "entry/src/main/ets/contract/Motion.ets",
  tokenContract: "entry/src/main/ets/contract/Token.ets"
};

function read(relPath) {
  const filePath = path.join(repoRoot, relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required file: ${relPath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function check(name, relPath, predicate, detail) {
  let passed = false;
  let error = "";
  try {
    passed = predicate(read(relPath));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return {
    name,
    file: relPath,
    passed,
    detail,
    error: passed ? undefined : (error || detail)
  };
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function countAssertions(text) {
  return (text.match(/r\.assert\(/g) || []).length;
}

function hdcProbe() {
  const bin = process.env.HDC_BIN || "hdc";
  const result = spawnSync(bin, ["list", "targets"], { cwd: repoRoot, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const targets = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "[Empty]" && !line.startsWith("["));
  return {
    command: `${bin} list targets`,
    exitCode: result.status,
    output,
    targetCount: targets.length,
    deviceBlocked: result.status !== 0 || targets.length === 0
  };
}

const checks = [
  check(
    "app-shell-validator-manifest",
    files.appShellValidator,
    (text) => includesAll(text, [
      "APP_SHELL_REDUCER_VALIDATOR_COVERAGE",
      "Frontend Slice 0/1 AppShell Reducer",
      "readerHeadlessTest",
      "HEADLESS_TEST_JSON"
    ]),
    "Validator exports the Slice 1 coverage manifest used by static and runtime evidence."
  ),
  check(
    "app-shell-validator-assertion-groups",
    files.appShellValidator,
    (text) => countAssertions(text) >= 35 && includesAll(text, [
      "Overlay mutex replaces previous overlay with latest overlay",
      "Overlay close restores focus to trigger",
      "activeSession mutex stops TTS when auto-page starts",
      "Async stale completion is discarded by requestId",
      "Generated motionSpecRegistry exposes tab.switch",
      "Generated tokenRegistry exposes tabSwitch motion-duration token"
    ]),
    "Validator covers overlay mutex, focus restore, activeSession mutex, async stale guard, and generated registries."
  ),
  check(
    "testinfra-registers-app-shell-suite",
    files.testInfra,
    (text) => includesAll(text, [
      "runAppShellReducerTests",
      "Frontend Slice 0/1 AppShell Reducer"
    ]),
    "TestInfra includes the AppShell reducer suite in the runtime headless aggregation."
  ),
  check(
    "entryability-headless-runtime-hook",
    files.entryAbility,
    (text) => includesAll(text, [
      "readerHeadlessTest",
      "runAllDomainTests",
      "HEADLESS_TEST_JSON",
      "terminateSelf"
    ]),
    "EntryAbility exposes the hdc-triggered headless runtime hook without requiring visible UI navigation."
  ),
  check(
    "motion-contract-registry-present",
    files.motionContract,
    (text) => includesAll(text, [
      "export const motionSpecs",
      "export const motionSpecRegistry",
      "export function getMotionSpec",
      "tab.switch"
    ]),
    "Generated ArkTS Motion contract exposes typed specs and lookup."
  ),
  check(
    "token-contract-registry-present",
    files.tokenContract,
    (text) => includesAll(text, [
      "export const tokens",
      "export const tokenRegistry",
      "export function getToken",
      "--reader-ds-motion-duration-tabSwitch"
    ]),
    "Generated ArkTS Token contract exposes typed tokens and lookup."
  ),
  check(
    "motion-adapter-uses-generated-registry",
    files.motionAdapter,
    (text) => includesAll(text, [
      "getMotionSpec",
      "static generatedSpec",
      "spec.durationMs",
      "spec.easing"
    ]),
    "MotionAdapter resolves duration/easing through generated Motion registry."
  ),
  check(
    "token-adapter-uses-generated-registry",
    files.tokenAdapter,
    (text) => includesAll(text, [
      "getToken",
      "tokens.map",
      "token.category === 'motion-duration'",
      "tokens.filter"
    ]),
    "TokenAdapter resolves generated token values and registry coverage."
  ),
  check(
    "state-flow-consumes-adapters",
    files.stateFlow,
    (text) => includesAll(text, [
      "MotionAdapter.tabSwitch",
      "TokenAdapter.tabBarHeight",
      "TokenAdapter.mainNavZIndex"
    ]),
    "AppShellStateFlow consumes platform adapters instead of hard-coding Slice 1 shell values."
  ),
  check(
    "reducer-store-event-boundary",
    files.readerReducer,
    (text) => includesAll(text, [
      "'overlay.open'",
      "'session.start'",
      "'async.begin'",
      "'async.complete'",
      "ReaderUiReducer.openOverlay",
      "ReaderUiReducer.startReaderSession",
      "ReaderUiReducer.beginAsyncIntent",
      "ReaderUiReducer.completeAsyncIntent"
    ]),
    "ReaderReducer facade exposes route/overlay/session/async guard events for native UI dispatch."
  ),
  check(
    "store-facade-event-entry",
    files.readerUiStore,
    (text) => includesAll(text, [
      "openOverlay",
      "startSession",
      "beginAsyncIntent",
      "completeAsyncIntent"
    ]),
    "ReaderUiStore offers a minimal event facade for tests and ArkUI wiring."
  )
];

const hdc = hdcProbe();
const passed = checks.filter((item) => item.passed).length;
const failed = checks.length - passed;
const status = failed === 0
  ? (hdc.deviceBlocked ? "PASS_STATIC_DEVICE_BLOCKED" : "PASS_STATIC_DEVICE_AVAILABLE")
  : "FAIL";

const summary = {
  schemaVersion: "harmonyos-frontend-slice1-headless-static.v1",
  status,
  generatedAt: new Date().toISOString(),
  runtimeExecuted: false,
  runtimeBoundary: "This static validator proves source inclusion and contract bridge wiring. It does not prove ArkUI runtime behavior, screenshots, gestures, accessibility focus, simulator, or real-device execution.",
  hdc,
  summary: {
    passed,
    failed,
    total: checks.length
  },
  checks
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(latestDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(path.join(latestDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(`[frontend-slice1-headless] status=${status}`);
console.log(`[frontend-slice1-headless] checks=${passed}P ${failed}F / ${checks.length}`);
console.log(`[frontend-slice1-headless] hdc=${hdc.deviceBlocked ? "blocked" : "target-available"}`);
console.log(`[frontend-slice1-headless] artifact=${path.relative(repoRoot, path.join(latestDir, "summary.json"))}`);

if (failed > 0) {
  process.exit(1);
}
