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

function findRecordRegistry(source, registryName, recordType) {
  const marker = `export const ${registryName}: ${recordType} = `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Missing generated registry marker: ${registryName}`);
  }
  const openIndex = source.indexOf("{", markerIndex + marker.length);
  if (openIndex < 0) {
    throw new Error(`Missing opening registry brace: ${registryName}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const endIndex = i + 1;
        const semicolonIndex = source.indexOf(";", endIndex);
        return {
          before: source.slice(0, markerIndex),
          body: source.slice(openIndex + 1, i),
          after: source.slice(semicolonIndex + 1)
        };
      }
    }
  }
  throw new Error(`Could not parse generated registry: ${registryName}`);
}

function parseRecordEntries(body) {
  const entries = [];
  let i = 0;

  function skipWhitespaceAndCommas() {
    while (i < body.length && (/[\s,]/).test(body[i])) i++;
  }

  function readString() {
    if (body[i] !== '"') {
      throw new Error(`Expected quoted registry key near: ${body.slice(i, i + 24)}`);
    }
    i++;
    let value = "";
    while (i < body.length) {
      const ch = body[i];
      if (ch === "\\") {
        value += ch + body[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        return value;
      }
      value += ch;
      i++;
    }
    throw new Error("Unterminated registry key");
  }

  function readObjectLiteral() {
    if (body[i] !== "{") {
      throw new Error(`Expected object literal near: ${body.slice(i, i + 24)}`);
    }
    const start = i;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < body.length; i++) {
      const ch = body[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          i++;
          return body.slice(start, i);
        }
      }
    }
    throw new Error("Unterminated registry object literal");
  }

  while (i < body.length) {
    skipWhitespaceAndCommas();
    if (i >= body.length) break;
    const key = readString();
    skipWhitespaceAndCommas();
    if (body[i] !== ":") {
      throw new Error(`Expected colon after registry key: ${key}`);
    }
    i++;
    skipWhitespaceAndCommas();
    const value = readObjectLiteral();
    entries.push({ key, value });
  }

  return entries;
}

function indentBlock(block, spaces) {
  const prefix = " ".repeat(spaces);
  return block.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function transformRegistryForArkTS(source, config) {
  const registry = findRecordRegistry(source, config.registryName, config.recordType);
  const entries = parseRecordEntries(registry.body);
  const interfaceBlock = [
    `export interface ${config.interfaceName} {`,
    ...entries.map((entry) => `  "${entry.key}": ${config.valueType};`),
    "}",
    ""
  ].join("\n");
  const arrayBlock = [
    `export const ${config.arrayName}: ${config.valueType}[] = [`,
    entries.map((entry) => indentBlock(entry.value, 2)).join(",\n"),
    "];",
    ""
  ].join("\n");
  const registryBlock = [
    `export const ${config.registryName}: ${config.interfaceName} = {`,
    entries.map((entry, index) => `  "${entry.key}": ${config.arrayName}[${index}]`).join(",\n"),
    "};",
    ""
  ].join("\n");
  const lookupBlock = config.lookupBlock(config);
  return `${registry.before}${interfaceBlock}${arrayBlock}${registryBlock}${lookupBlock}`;
}

function transformMotion(source) {
  return transformRegistryForArkTS(source, {
    registryName: "motionSpecRegistry",
    recordType: "Record<MotionId, Motion>",
    interfaceName: "MotionSpecRegistry",
    arrayName: "motionSpecs",
    valueType: "Motion",
    lookupBlock: () => `export function getMotionSpec(id: MotionId): Motion | undefined {
  for (let i = 0; i < motionSpecs.length; i++) {
    if (motionSpecs[i].id === id) {
      return motionSpecs[i];
    }
  }
  return undefined;
}
`
  });
}

function transformToken(source) {
  return transformRegistryForArkTS(source, {
    registryName: "tokenRegistry",
    recordType: "Record<string, Token>",
    interfaceName: "TokenRegistry",
    arrayName: "tokens",
    valueType: "Token",
    lookupBlock: () => `export function getToken(name: string): Token | undefined {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].name === name) {
      return tokens[i];
    }
  }
  return undefined;
}
`
  });
}

function expectedContractFile(fileName) {
  const source = readFile(path.join(sourceDir, fileName));
  let transformed = source;
  if (fileName === "UiState.ets") transformed = transformUiState(transformed);
  if (fileName === "Route.ets") transformed = transformRoute(transformed);
  if (fileName === "Motion.ets") transformed = transformMotion(transformed);
  if (fileName === "Token.ets") transformed = transformToken(transformed);
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
