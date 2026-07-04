#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const readerUiRoot =
  process.env.READER_UI_ROOT || path.resolve(repoRoot, "../Reader UI");
const sourceDir = path.join(readerUiRoot, "generated/arkts");
const targetDir = path.join(repoRoot, "entry/src/main/ets/contract");
const fix = process.argv.includes("--fix");

const exportOrder = [
  "UiState",
  "Route",
  "Motion",
  "Token",
  "ViewState",
  "StateRule",
  "CoreCommand",
  "CoreEvent",
  "UiEvent",
  "HostRequest",
  "Content",
  "ProgressLocation",
  "SyncConflict"
];

function readFile(requiredPath) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing required file: ${requiredPath}`);
  }
  return fs.readFileSync(requiredPath, "utf8");
}

function listSourceFiles() {
  return fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith(".ets"))
    .sort();
}

function withSyncHeader(fileName, source) {
  const lines = source.split("\n");
  if (lines.length < 2 || !lines[0].startsWith("// AUTO-GENERATED") || !lines[1].startsWith("// Source:")) {
    throw new Error(`Unexpected generated header in ${fileName}`);
  }
  return [
    lines[0],
    lines[1],
    `// Synced from: ${path.join(sourceDir, fileName)}`,
    "// Phase 1.1: Contract sync. Edit Reader UI/contracts, regenerate, then resync this directory.",
    ...lines.slice(2)
  ].join("\n");
}

function transformUiState(source) {
  let output = source
    .replace("export interface ReaderUiState {", "export interface ReaderUiStateContract {")
    .replace("  reader?: ReaderUiState;", "  reader?: ReaderUiStateContract;");

  if (!output.includes("export type MainTab =")) {
    output = output.replace(
      "\nexport interface UiState {\n",
      '\nexport type MainTab =\n  | "bookshelf"\n  | "discover"\n  | "rss"\n  | "settings";\n\nexport interface UiState {\n'
    );
  }
  return output;
}

function transformRoute(source) {
  let output = source.replace(
    /export type MainTab =\n  \| "bookshelf"\n  \| "discover"\n  \| "rss"\n  \| "settings";\n\n/,
    "// MainTab is imported from UiState.ets to avoid duplicate contract entry exports.\n\n"
  );
  output = output.replace(
    "export type RouteId =\n",
    "import type { MainTab } from './UiState';\n\nexport type RouteId =\n"
  );
  if (!output.endsWith("\n")) output += "\n";
  output += "\n// Re-export MainTab to keep the contract entrypoint stable.\nexport type { MainTab } from './UiState';\n";
  return output;
}

function transformViewState(source) {
  return source.replace(
    "export type ComponentType =\n",
    "import type { PageState } from './UiState';\n\nexport type ComponentType =\n"
  );
}

function expectedContractFile(fileName) {
  const source = readFile(path.join(sourceDir, fileName));
  let transformed = source;
  if (fileName === "UiState.ets") transformed = transformUiState(transformed);
  if (fileName === "Route.ets") transformed = transformRoute(transformed);
  if (fileName === "ViewState.ets") transformed = transformViewState(transformed);
  return withSyncHeader(fileName, transformed);
}

function expectedIndex() {
  return `// Reader Contract - ArkTS type entrypoint
// Synced from Reader UI/generated/arkts.
// Edit Reader UI/contracts, run tools/codegen/generate.mjs, then run this script with --fix.
${exportOrder.map((name) => `export * from './${name}';`).join("\n")}
`;
}

function writeIfNeeded(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current !== content) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const sourceFiles = listSourceFiles();
const expectedNames = new Set(sourceFiles);
const drift = [];
let fixedCount = 0;

for (const fileName of sourceFiles) {
  const targetPath = path.join(targetDir, fileName);
  const expected = expectedContractFile(fileName);
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  if (current !== expected) {
    drift.push(fileName);
    if (fix && writeIfNeeded(targetPath, expected)) fixedCount += 1;
  }
}

const targetGeneratedFiles = fs
  .readdirSync(targetDir)
  .filter((name) => name.endsWith(".ets") && name !== "index.ets");
const extraTargetFiles = targetGeneratedFiles.filter((name) => !expectedNames.has(name));
const indexPath = path.join(targetDir, "index.ets");
const expectedIndexContent = expectedIndex();
const currentIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;
const indexDrift = currentIndex !== expectedIndexContent;
if (indexDrift) {
  drift.push("index.ets");
  if (fix && writeIfNeeded(indexPath, expectedIndexContent)) fixedCount += 1;
}

console.log(`[contract-drift] Reader UI ArkTS generated files: ${sourceFiles.length}`);
console.log(`[contract-drift] HarmonyOS contract files: ${targetGeneratedFiles.length}`);

if (extraTargetFiles.length > 0) {
  console.error(`[contract-drift] extra HarmonyOS contract files: ${extraTargetFiles.join(", ")}`);
}

if (drift.length > 0 && !fix) {
  console.error(`[contract-drift] out-of-sync files: ${drift.join(", ")}`);
  process.exit(1);
}

if (drift.length > 0 && fix) {
  console.log(`[contract-drift] fixed files: ${fixedCount}`);
}

if (extraTargetFiles.length > 0) {
  process.exit(1);
}
