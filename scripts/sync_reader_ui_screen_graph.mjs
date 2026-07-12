import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const READER_UI = process.env.READER_UI_REPO || path.resolve(REPO, '../Reader-UI');
const SOURCE_DIR = path.join(READER_UI, 'generated', 'arkts');
const DEST_DIR = path.join(REPO, 'entry', 'src', 'main', 'ets', 'contract', 'reader_ui');
const GRAPH_JSON = path.join(READER_UI, 'ui-spec', 'screen-graph.json');
const VIEW_STATE_RENDERER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'components', 'ViewStateRenderer.ets');
const FILES = ['Route.ets', 'ViewState.ets', 'UiEvent.ets', 'UiState.ets', 'ScreenGraph.ets'];
const CHECK = process.argv.includes('--check');

function harmonyCompatibleSource(file, source) {
  // Reader UI's schema files are generated as a family and TypeScript can
  // resolve these cross-file names in its aggregate compile. ArkTS requires
  // explicit imports. ScreenGraph.ets itself remains byte-for-byte canonical;
  // only the two dependency files receive deterministic import completion.
  if (file === 'ViewState.ets') {
    return source.replace(
      '// Source: contracts/view-state.schema.json\n',
      "// Source: contracts/view-state.schema.json\nimport { PageState } from './UiState';\n",
    );
  }
  if (file === 'UiState.ets') {
    return source.replace(
      '// Source: contracts/ui-state.schema.json\n',
      "// Source: contracts/ui-state.schema.json\nimport { MainTab } from './Route';\n",
    );
  }
  return source;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== 'object') return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalValue(value[key]);
  return result;
}

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`ScreenGraph.ets missing ${label}`);
  return match[1];
}

function countComponents(components) {
  let count = 0;
  let bindings = 0;
  let stateEventEvidence = 0;
  for (const component of components || []) {
    count += 1;
    bindings += (component.bindings || []).length;
    stateEventEvidence += (component.stateEventEvidence || []).length;
    const child = countComponents(component.children || []);
    count += child.components;
    bindings += child.bindings;
    stateEventEvidence += child.stateEventEvidence;
  }
  return { components: count, bindings, stateEventEvidence };
}

for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  if (!fs.existsSync(sourcePath)) throw new Error(`Reader UI generated ArkTS source missing: ${sourcePath}`);
}
if (!fs.existsSync(GRAPH_JSON)) throw new Error(`Reader UI screen graph JSON missing: ${GRAPH_JSON}`);

if (!CHECK) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  for (const file of FILES) {
    const source = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
    fs.writeFileSync(path.join(DEST_DIR, file), harmonyCompatibleSource(file, source));
  }
}

const failures = [];
for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const destinationPath = path.join(DEST_DIR, file);
  if (!fs.existsSync(destinationPath)) {
    failures.push(`missing synced file ${file}`);
    continue;
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  const expected = harmonyCompatibleSource(file, source);
  const destination = fs.readFileSync(destinationPath, 'utf8');
  if (expected !== destination) failures.push(`deterministic sync drift ${file}`);
}

const screenGraphSource = fs.readFileSync(path.join(SOURCE_DIR, 'ScreenGraph.ets'), 'utf8');
const graphBytes = fs.readFileSync(GRAPH_JSON);
const graph = JSON.parse(graphBytes.toString('utf8'));
const sourceSha = sha256(Buffer.from(screenGraphSource));
const canonicalSha = sha256(JSON.stringify(canonicalValue(graph)));
const declaredCanonicalSha = requiredMatch(screenGraphSource, /static readonly sha256: string = "([0-9a-f]{64})"/, 'canonical sha256');
const declaredRouteCount = Number(requiredMatch(screenGraphSource, /static readonly routeCount: number = (\d+)/, 'routeCount'));
const declaredVariantCount = Number(requiredMatch(screenGraphSource, /static readonly variantCount: number = (\d+)/, 'variantCount'));
const declaredComponentCount = Number(requiredMatch(screenGraphSource, /static readonly componentCount: number = (\d+)/, 'componentCount'));
const declaredBindingCount = Number(requiredMatch(screenGraphSource, /static readonly bindingCount: number = (\d+)/, 'bindingCount'));
const declaredStateEventEvidenceCount = Number(requiredMatch(screenGraphSource, /static readonly stateEventEvidenceCount: number = (\d+)/, 'stateEventEvidenceCount'));

let variantCount = 0;
let componentCount = 0;
let bindingCount = 0;
let stateEventEvidenceCount = 0;
let actionGapCount = 0;
for (const route of graph.routes || []) {
  variantCount += (route.variants || []).length;
  for (const variant of route.variants || []) {
    actionGapCount += (variant.actionGaps || []).length;
    const counts = countComponents(variant.components || []);
    componentCount += counts.components;
    bindingCount += counts.bindings;
    stateEventEvidenceCount += counts.stateEventEvidence;
  }
}

const rendererSource = fs.readFileSync(VIEW_STATE_RENDERER, 'utf8');
const rendererMappings = new Set(
  [...rendererSource.matchAll(/component\.type === '([^']+)'/g)].map((match) => match[1]),
);
const referencedComponentTypes = (graph.componentCatalog || [])
  .filter((entry) => entry.status === 'referenced')
  .map((entry) => entry.type);
const explicitGapComponentTypes = (graph.componentCatalog || [])
  .filter((entry) => entry.status === 'explicit-gap')
  .map((entry) => entry.type);
const missingRendererMappings = referencedComponentTypes.filter((type) => !rendererMappings.has(type));
if (missingRendererMappings.length > 0) {
  failures.push(`missing renderer mappings: ${missingRendererMappings.join(',')}`);
}
if (!rendererSource.includes('Reader UI 组件契约漂移')) {
  failures.push('unknown ComponentType is not visibly fail-closed');
}

const actual = {
  routeCount: (graph.routes || []).length,
  variantCount,
  componentCount,
  bindingCount,
  stateEventEvidenceCount,
};
const declared = {
  routeCount: declaredRouteCount,
  variantCount: declaredVariantCount,
  componentCount: declaredComponentCount,
  bindingCount: declaredBindingCount,
  stateEventEvidenceCount: declaredStateEventEvidenceCount,
};
if (declaredCanonicalSha !== canonicalSha) failures.push('canonical screen-graph.json sha256 drift');
for (const key of Object.keys(actual)) {
  if (actual[key] !== declared[key]) failures.push(`${key} declared=${declared[key]} actual=${actual[key]}`);
}

if (failures.length > 0) {
  console.error(`[screen-graph-consumer] FAIL sourceSha256=${sourceSha} canonicalSha256=${canonicalSha}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `[screen-graph-consumer] PASS authority=Shadow sourceSha256=${sourceSha} ` +
  `canonicalSha256=${canonicalSha} routes=${actual.routeCount} variants=${actual.variantCount} ` +
  `components=${actual.componentCount} bindings=${actual.bindingCount} ` +
  `stateEvidence=${actual.stateEventEvidenceCount} actionGaps=${actionGapCount} ` +
  `componentTypes=${referencedComponentTypes.length}+${explicitGapComponentTypes.length}gap ` +
  `rendererMappings=${rendererMappings.size}`
);
