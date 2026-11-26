import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve, posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { capsuleModelInputFile, capsuleModelInputPaths } from '../ui-contract/lib/capsule-model-inputs.mjs';
import { caseRegistryPaths, readCaseRegistrations } from '../ui-contract/lib/case-registry.mjs';
import { grabberReversalRunnerInputs } from '../ui-contract/lib/control-input.mjs';
import { conditionBoundSourceKinds } from '../ui-contract/lib/source-read.mjs';
import { resolveStructureBindings, resolveStructureCondition, validateStructureDefinition } from '../ui-contract/lib/structure-contract.mjs';
import { sourceUnknownExpandSteps, usesSourceUnknownExpand } from '../ui-contract/lib/source-unknown-expand.mjs';
import { sourceGestureAssertion } from '../ui-contract/lib/source-gesture-assertion.mjs';
import { sourceE2AdmissionGap, sourceE3AdmissionGap } from '../page-structure/receipt-evidence.mjs';
import { isSourceE2Claim, sourceE2MissingTouchReferences, sourceE2TouchAssertion } from '../page-structure/source-e2-admission.mjs';
import { isSourceE3Claim } from '../page-structure/source-e3-admission.mjs';
import { gateResourceDefinitionSha256 } from './gate-resource-definition.mjs';

const catalogFile = 'tools/gate-index.json';
const resourceManifestFile = 'tools/contract-case-manifest.json';
const retiredFile = 'tools/retired-contract-tests.json';
const modelFile = 'tools/page-structure/model.json';
const registerFile = 'tools/page-structure/register.json';
const caseDir = 'tools/ui-contract/cases';
const ui = 'tools/ui-contract';
const caseRegistries = caseRegistryPaths.map(path => `${ui}/${path}`);
const caseLoader = `${ui}/lib/cases.mjs`;
const replayLockFile = `${ui}/package-lock.json`;
const receiptFile = `${ui}/lib/receipt.mjs`;
const receiptStructure = `${ui}/lib/receipt-structure.mjs`;
const reassessmentFile = `${ui}/reassess-structure.mjs`;
const coverageFile = `${ui}/coverage.mjs`;
const exportFile = `${ui}/export-replay.mjs`;
const registrationEntry = 'tools/page-structure/check-register.mjs';
const registrationAdapter = 'tools/page-structure/receipt-evidence.mjs';
const sourceGesturePolicy = `${ui}/lib/source-gesture-assertion.mjs`;
const schemaLibrary = 'tools/page-structure/lib.mjs';
const reviewedEntry = 'tools/gate-index.mjs';
const impactEntry = 'tools/gate-index-impact.mjs';
const impactReaderFile = 'tools/lib/gate-index-impact.mjs';
const validCaseId = /^[a-z][a-z0-9.-]*$/u;
const validAssertionId = /^[a-zA-Z][a-zA-Z0-9_.:-]*$/u;
const evaluatorFiles = new Set(['layout', 'search', 'motion', 'source'].map(id => `${ui}/lib/${id}.mjs`));
const motionFile = `${ui}/lib/motion.mjs`;
const controlEffectsFile = `${ui}/lib/control-effects.mjs`;
const capsuleFile = `${ui}/lib/control-capsule.mjs`;
const capsuleHandoffFile = `${ui}/lib/control-capsule-handoff.mjs`;
const capsuleModelsFile = `${ui}/${capsuleModelInputFile}`;
const capsuleInputReader = `${ui}/lib/capsule-model-inputs.mjs`;
const capsuleLoadExpression = "'../../../' + path";
const motionEffect = assertion => assertion.evaluator === 'motion' && assertion.kind === 'control-effect';
const scopedDispatches = [
  {
    importer: motionFile, dependency: controlEffectsFile, names: ['evaluateControlEffect'],
    use: "if (assertion.kind === 'control-effect') return evaluateControlEffect(assertion, context);",
    matches: motionEffect, branch: 'reading control effect',
  },
  {
    importer: controlEffectsFile, dependency: capsuleFile, names: ['checkCapsuleLaunch', 'checkCapsulePause'],
    use: "else if (expected.effect === 'capsule-launch') { if (expected.openAction) checkCapsulePause(observed); else probeRead = checkCapsuleLaunch(observed); }",
    matches: assertion => motionEffect(assertion) && assertion.expected?.effect === 'capsule-launch' &&
      assertion.expected.pauseAction === undefined && assertion.expected.op !== 'clickThenReaderCenter',
    branch: 'reading capsule launch or pause',
    outerDispatch: motionFile,
  },
  {
    importer: controlEffectsFile, dependency: capsuleHandoffFile, names: ['checkLaunchInterruption','checkCapsuleHandoff'],
    use: [
      "else if (expected.effect === 'capsule-launch' && expected.pauseAction) {",
      "else if (expected.effect === 'capsule-launch' && expected.op === 'clickThenReaderCenter') checkLaunchInterruption(observed,action);",
    ],
    matches: assertion => motionEffect(assertion) && assertion.expected?.effect === 'capsule-launch' &&
      (Boolean(assertion.expected.pauseAction) || assertion.expected.op === 'clickThenReaderCenter'),
    branch: 'reading capsule handoff or launch interruption', outerDispatch: motionFile,
  },
  {
    importer: receiptFile, dependency: capsuleFile, names: ['systemSpeechApplicability'],
    use: 'const tts = systemSpeechApplicability(assertion, context, contract);',
    assertions: 'for (const assertion of contract.assertions) {',
    projection: '{ ...assessed.actual, systemSpeechApplicability:tts }',
    guard: [
      'export function systemSpeechApplicability(assertion, context, contract) {',
      'const expected = assertion.expected;',
      "if (assertion.required !== false || !assertion.condition || assertion.kind !== 'control-effect' ||",
      "expected.effect !== 'capsule-launch' || expected.type !== 'tts') return null;",
    ].join(' '),
    matches: assertion => assertion.required === false && Boolean(assertion.condition) && assertion.kind === 'control-effect' &&
      assertion.expected?.effect === 'capsule-launch' && assertion.expected?.type === 'tts',
    branch: 'conditional system speech',
  },
];
const scopedDependencies = new Set(scopedDispatches.map(dispatch => dispatch.dependency));
const consumerEntries = new Map([
  [impactEntry, `node ${impactEntry} --affected <path>`],
  [coverageFile, `node ${coverageFile} --selection <selected-receipts.json>`],
  [registrationEntry, `node ${registrationEntry}`],
  [exportFile, `node ${exportFile} <new-output-directory>`],
  [reassessmentFile, `node ${reassessmentFile} --input <original-receipt> --expected-root <sha256> --bindings <historical-bindings.json>`],
  [`${ui}/reseal.mjs`, `node ${ui}/reseal.mjs --case <case-id> --input <original-receipt> --expected-root <sha256> --output-dir <new-output-directory>`],
]);
const evidenceLimit = 'Read-only relationship evidence. Choose execution separately; qualification, identity and result require their own admission.';
const unknownGapKinds = new Set(['DYNAMIC_REFERENCE', 'UNKNOWN_ID', 'UNMAPPED_PATH']);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileId = (file) => `file:${file}`;
const caseId = (id) => `ui-case:${id}`;
const ruleId = (id) => `structure-rule:${id}`;
const selectorId = (id) => `structure-selector:${id}`;
const gateId = (id) => `gate:${id}`;
const fixturePath = /^tools\/ui-contract\/fixtures\/(?:[\p{L}\p{N}][\p{L}\p{N} ._-]*\/)*[\p{L}\p{N}][\p{L}\p{N} ._-]*\.(?:json|txt)$/u;
const packagedFixturePath = /^entry\/src\/main\/resources\/rawfile\/reader-public-fixture-[a-z0-9]+(?:-[a-z0-9]+)*-v[0-9]+\.(?:json|txt)$/u;
const localSupportFile = 'tools/ui-contract-impact-bindings.json';
const localCheckPath = /^tools\/ui-contract\/test\/[A-Za-z0-9_-]+\.test\.mjs$/u;
const localContractPath = /^tools\/test-[A-Za-z0-9_-]+\.mjs$/u;
const localContractRunner = 'tools/lib/contract-case-selection.mjs';
const testCall = /^test\(\s*("(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*')\s*,/gmu;
const shellArgument = value => "'" + value.replaceAll("'", "'\\''") + "'";

function maskInactiveSource(source, {keepStrings = true, keepTemplates = false} = {}) {
  return source.replace(/"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/gu,
    token => (keepStrings && (token[0] === "'" || token[0] === '"')) || (keepTemplates && token[0] === '`')
      ? token : token.replace(/[^\r\n]/gu, ' '));
}

function localTestLiterals(source) {
  const code = maskInactiveSource(source);
  if (!/^import\s+(?:test|\{\s*test\s*\})\s+from\s+['"]node:test['"]/mu.test(code)) return [];
  return [...code.matchAll(testCall)].map(match => match[1]);
}

function localContractCaseNames(source) {
  const code = maskInactiveSource(source);
  const selectorImport = /^import\s+\{\s*selectContractCases\s*(?:,\s*recordContractCasePass\s*)?\}\s+from\s+(['"])\.\/lib\/contract-case-selection\.mjs\1;/mu;
  if (!selectorImport.test(code)) return [];
  const selectedTable = tail => /^\s*(?:const\s+\w+\s*=\s*selectContractCases\(\s*(\w+)\s*\);|for\s*\(\s*const\s+\w+\s+of\s+selectContractCases\(\s*(\w+)\s*\)\s*\)\s*\{)/u
    .exec(tail)?.slice(1).find(name => name !== undefined);
  // Recognize an import-only header followed by the shared literal table and
  // its immediate runner call. Computed declarations have no static selector.
  const declaration = /^const ([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Object\.fromEntries\(\s*\[[ \t]*$/mu.exec(code);
  if (!declaration) return localContractObjectNames(code, selectorImport, selectedTable);
  const header = code.slice(0, declaration.index);
  if (!/^(?:\s*import[ \t]+[^;\r\n]+;)*\s*$/u.test(header) || !selectorImport.test(header)) return [];
  const table = code.slice(declaration.index + declaration[0].length);
  const mapped = /^[ \t]*\]\.map\(\s*\(\[id,\s*description\]\)\s*=>\s*\[id,\s*\{\s*description,\s*resources:\s*\[\]\s*\}\]\s*\)\);/mu.exec(table);
  if (!mapped) return [];
  if (selectedTable(table.slice(mapped.index + mapped[0].length)) !== declaration[1]) return [];
  const row = /^\s*\[\s*(['"])([a-z][a-z0-9.-]*)\1\s*,\s*(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*')\s*\](,?)\s*$/u;
  const entries = table.slice(0,mapped.index).split(/\r?\n/u).filter(line => line.trim()).map(line => row.exec(line));
  const literalList = entries.every((entry,index) => entry && (entry[3] === ',' || index === entries.length-1));
  return literalList ? entries.map(entry => entry[2]) : [];
}

function localContractObjectNames(code, selectorImport, selectedTable) {
  const string = String.raw`(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*')`;
  const resources = String.raw`\[\s*(?:${string}(?:\s*,\s*${string})*\s*,?\s*)?\]`;
  const descriptor = String.raw`\{\s*(?:"description"|'description'|description)\s*:\s*${string}\s*,\s*(?:"resources"|'resources'|resources)\s*:\s*${resources}\s*,?\s*\}`;
  const literalEntry = new RegExp(String.raw`\s*(?:(['"])([a-z][a-z0-9.-]*)\1|([a-z][a-z0-9]*))\s*:\s*(?:${string}|${descriptor})\s*(,|(?=\}))`, 'yu');
  const declarations = /^const\s+(\w+)\s*=\s*\{/gmu;
  for (const declaration of code.matchAll(declarations)) {
    const header = code.slice(0, declaration.index);
    if (!selectorImport.test(header)) continue;
    // Local declarations can precede the table. A declaration inside a helper
    // or exported callback cannot establish the module's CLI dispatch.
    const brackets = maskInactiveSource(header, { keepStrings: false }).match(/[()[\]{}]/gu) ?? [];
    const stack = [];
    const openings = { ')': '(', ']': '[', '}': '{' };
    for (const bracket of brackets) {
      if (Object.hasOwn(openings, bracket)) {
        if (stack.pop() !== openings[bracket]) { stack.push('invalid'); break; }
      } else stack.push(bracket);
    }
    if (stack.length) continue;
    let end = declaration.index + declaration[0].length;
    const names = [];
    for (;;) {
      literalEntry.lastIndex = end;
      const entry = literalEntry.exec(code);
      if (!entry) break;
      names.push(entry[2] ?? entry[3]);
      end = literalEntry.lastIndex;
      if (entry[4] !== ',') break;
    }
    const closing = /^\s*\};/u.exec(code.slice(end));
    if (closing && selectedTable(code.slice(end + closing[0].length)) === declaration[1]) {
      return new Set(names).size === names.length ? names : [];
    }
  }
  return [];
}

function exactLocalCheck(path, name) {
  const pattern = '^' + name.replace(/[.*+?^$\{\}()|[\]\\]/gu, '\\$&') + '$';
  return 'node --test --test-name-pattern ' + shellArgument(pattern) + ' ' + path;
}

function relativeInput(value) {
  if (typeof value !== 'string' || !value || /[\\\u0000-\u001f]/u.test(value) ||
      posix.isAbsolute(value) || value.split('/').includes('..')) {
    throw new Error(`Expected a repository-relative path, got ${JSON.stringify(value)}.`);
  }
  const normalized = posix.normalize(value).replace(/\/$/u, '');
  if (normalized === '.') throw new Error('A changed file path is required.');
  return normalized;
}

function localModuleReferences(source, { declaredCalls = [], boundUrlIndex } = {}) {
  // Check the keyword position in the mask, and read literal arguments from
  // the original text. Keep templates visible because they can evaluate an import.
  const executable = maskInactiveSource(source, {keepStrings:false, keepTemplates:true});
  const activeMatches = pattern => [...source.matchAll(pattern)].filter(match => {
    const head = match.index + match[0].search(/\S/u);
    return executable[head] === source[head];
  });
  const declarations = /^\s*(?:import|export)\s+(?:([\w\s{},*$]+?)\s+from\s+)?['"]([^'"\n]+)['"]/gmu;
  const operations = /\b(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1\s*[,)]/gu;
  const urlBases = new Map(activeMatches(/^(?:export )?const (\w+)\s*=\s*new URL\(\s*(['"])(\.[^'"\n]*\/)\2\s*,\s*import\.meta\.url\s*\)/gmu)
    .map(([, name, , path]) => [name, path]));
  const fileUrls = [];
  let unresolvedBase = false;
  for (const url of activeMatches(/\bnew URL\(\s*(['"])([A-Za-z0-9._/-]+\.(?:[cm]?js|ts|ets|json))\1\s*,\s*(import\.meta\.url|\w+)\s*\)/gu)) {
    if (url.index === boundUrlIndex) continue;
    const [, , path, base] = url;
    if (base === 'import.meta.url') fileUrls.push(path);
    else if (urlBases.has(base)) fileUrls.push(posix.join(urlBases.get(base), path));
    else unresolvedBase = true;
  }
  const literalModule = /^\s*(['"])[^'"\n]+\1\s*(?:,|$)/u;
  const computedCalls = activeMatches(/\b(?:import|require)\s*\(([^)\n]*)/gu)
    .map(([, args]) => args.trim()).filter(args => !literalModule.test(args));
  for (const call of declaredCalls) {
    const boundIndex = computedCalls.indexOf(call);
    if (boundIndex >= 0) computedCalls.splice(boundIndex, 1);
  }
  const imports = [...new Set([
    ...activeMatches(declarations).filter(([, clause]) => !/^\s*type\s/u.test(clause ?? ''))
      .map(([, , path]) => path),
    ...activeMatches(operations).map(match => match[2]),
  ])];
  return {
    paths: [...new Set([...imports.filter(path => path.startsWith('.')), ...fileUrls])],
    external: imports.filter(path => !path.startsWith('.')),
    unresolved: unresolvedBase || computedCalls.length > 0,
  };
}

function schemaValidatorUses(source, file) {
  const code = maskInactiveSource(source);
  const imports = [...code.matchAll(/^import[ \t]+\{([^}\r\n]*)\}[ \t]+from[ \t]+(['"])(\.[^'"\r\n]+)\2/gmu)]
    .filter(([, , , path]) => posix.normalize(posix.join(posix.dirname(file), path)) === schemaLibrary)
    .flatMap(([, names]) => names.split(',').map(name => name.trim()));
  if (!imports.some(name => /^schemaValidator(?:\s|$)/u.test(name))) return null;
  if (!imports.includes('schemaValidator')) return {known:false, paths:[], unknown:true};

  const destructured = [...code.matchAll(/^[ \t]*const[ \t]+\{\s*ajv,\s*dependency\s*\}\s*=\s*schemaValidator\(\)(?=[ \t]*(?:[,;]|$))/gmu)];
  const compile = /^[ \t]*(?:(?:const|let)[ \t]+\w+|if[ \t]*\(!\w+\)[ \t]+\w+)[ \t]*=[ \t]*schemaValidator\(\)\.ajv\.compile\(readJSON\((['"])(tools\/page-structure\/schema\/[A-Za-z0-9_-]+\.schema\.json)\1\)(?:\.definitions\.[A-Za-z_$][\w$]*)?\);[ \t]*$/gmu;
  const compiled = imports.includes('readJSON') ? [...code.matchAll(compile)] : [];
  const knownCalls = destructured.length + compiled.length;
  const references = maskInactiveSource(source,{keepStrings:false}).match(/\bschemaValidator\b/gu)?.length ?? 0;
  return { known:knownCalls > 0, paths:[...new Set(compiled.map(([, , path]) => path))],
    unknown:knownCalls === 0 || references !== 1 + knownCalls };
}

function agreesWithScopedDispatch(dispatch, importer, dependency) {
  // These are deliberately narrow source checks. An unfamiliar call site or
  // additional use keeps the original conservative file-level relationship.
  const oneLine = source => source.replace(/\s+/gu, ' ');
  const importPath = `./${posix.basename(dispatch.dependency)}`;
  const expectedImport = `import { ${dispatch.names.join(', ')} } from '${importPath}';`;
  const refs = localModuleReferences(importer);
  const targets = refs.paths.filter(path => posix.normalize(posix.join(posix.dirname(dispatch.importer), path)) === dispatch.dependency);
  const source = oneLine(importer);
  const uses = dispatch.projection ? source.replace(dispatch.projection, '') : source;
  const callSites = Array.isArray(dispatch.use) ? dispatch.use : [dispatch.use];
  return !refs.unresolved && targets.length === 1 && targets[0] === importPath &&
    source.includes(expectedImport) && callSites.every(callSite => source.includes(callSite)) &&
    (!dispatch.assertions || source.includes(dispatch.assertions)) &&
    importer.split(importPath).length === 2 &&
    dispatch.names.every(name => (uses.match(new RegExp(`\\b${name}\\b`, 'gu')) ?? []).length === 2) &&
    (!dispatch.guard || oneLine(dependency).includes(dispatch.guard));
}

function catalogBinding(path, binding) {
  const fileTokens = binding?.match(/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:ets|ts|mjs|json|py|rs)\b/gu) ?? [];
  const canonicalToken = (token) => token.startsWith('features/') || token.startsWith('app/') ||
    token.startsWith('pages/') ? `entry/src/main/ets/${token}` : token;
  const fileMatch = fileTokens.find(token => path === canonicalToken(token) || path.endsWith(`/${canonicalToken(token)}`));
  if (fileMatch) return fileMatch;
  const productionDirectory = 'entry/src/main/ets';
  if (binding?.includes(productionDirectory) && path.startsWith(`${productionDirectory}/`) &&
      !fileTokens.some(token => token.startsWith(`${productionDirectory}/`))) return productionDirectory;
  // Several reviewed catalog records name a source symbol without its file
  // extension. Treat a matching stem as a file-level hint only.
  const stem = posix.basename(path).match(/^([A-Z][A-Za-z0-9_]+)\.(?:ets|ts)$/u)?.[1];
  if (stem && new RegExp(`(?:^|[^\\w])${stem}(?:$|[^\\w])`, 'u').test(binding ?? '')) return stem;
  return null;
}

function collectReachable(start, adjacent) {
  const queue = [...start];
  const reached = new Set(start);
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of adjacent(queue[i])) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function collectReferences(direct, downstream) {
  const queue = [...direct].map(id => ({ id, throughImplementation: id.startsWith('file:') || id.startsWith('runtime:') }));
  const visited = new Set(queue.map(item => `${item.throughImplementation}:${item.id}`));
  const reached = new Set(direct);
  for (let i = 0; i < queue.length; i += 1) {
    const { id, throughImplementation } = queue[i];
    for (const edge of downstream.get(id) ?? []) {
      const codeConsumer = edge.consumer.startsWith('file:');
      // A rule flows into receipt and coverage code as a scoped obligation.
      // Scoped module loads keep the code consumer visible and rely on
      // direct assertion edges for subsequent case impact.
      if (edge.kind === 'implementation-use' && !codeConsumer && !throughImplementation) continue;
      const next = throughImplementation && codeConsumer && ['implementation-use', 'model-input', 'runtime-input'].includes(edge.kind);
      const key = `${next}:${edge.consumer}`;
      if (visited.has(key)) continue;
      visited.add(key);
      reached.add(edge.consumer);
      queue.push({ id: edge.consumer, throughImplementation: next });
    }
  }
  return reached;
}

function buildImpactGraph(root, changedPaths) {
  const nodes = new Map();
  const bindings = new Map();
  const edges = new Map();
  const upstream = new Map();
  const downstream = new Map();
  const gaps = [];
  const definitionIdentities = {};
  const scanned = new Set();
  const existing = new Map();
  const repoRealPath = realpathSync(root);
  let schemaRuntime;

  function localFile(path) {
    if (!existing.has(path)) {
      const location = resolve(root, path);
      const stat = lstatSync(location, { throwIfNoEntry: false });
      const actual = stat?.isFile() ? realpathSync(location) : null;
      existing.set(path, actual !== null && relative(repoRealPath, actual).split('/')[0] !== '..');
    }
    return existing.get(path);
  }

  function openDefinition(file, optional = false) {
    if (optional && !localFile(file)) {
      gaps.push({ kind: 'MISSING_DEFINITION', path: file });
      return undefined;
    }
    if (!localFile(file)) throw new Error(`Missing or out-of-tree index definition ${file}.`);
    const bytes = readFileSync(join(root, file));
    definitionIdentities[file] = hash(bytes);
    try {
      return JSON.parse(bytes);
    } catch {
      if (!optional) throw new Error(`Invalid JSON index definition ${file}.`);
      gaps.push({ kind: 'INVALID_DEFINITION', path: file });
      return undefined;
    }
  }

  function bind(id, path, reason) {
    const byId = bindings.get(path) ?? new Map();
    const reasons = byId.get(id) ?? new Set();
    reasons.add(reason);
    byId.set(id, reasons);
    bindings.set(path, byId);
  }

  function put(id, file, detail) {
    if (nodes.has(id)) {
      gaps.push({ kind: 'DUPLICATE_ID', id, path: file });
      return;
    }
    nodes.set(id, { id, file, ...detail });
    bind(id, file, 'maintenance definition');
  }

  function link(consumer, dependency, kind, reason, metadata) {
    const edge = { consumer, dependency, kind, reason, ...metadata };
    const key = JSON.stringify(edge);
    if (edges.has(key)) return;
    edges.set(key, edge);
    if (dependency.startsWith('file:') && !nodes.has(dependency)) {
      const path = dependency.slice('file:'.length);
      if (!localFile(path)) bind(dependency, path, 'declared tool input that no longer resolves');
    }
    const incoming = downstream.get(dependency) ?? [];
    const outgoing = upstream.get(consumer) ?? [];
    incoming.push(edge);
    outgoing.push(edge);
    downstream.set(dependency, incoming);
    upstream.set(consumer, outgoing);
  }

  function useSource(id, ref, reason) {
    if (typeof ref !== 'string' || !ref) return;
    const path = ref.split('#')[0];
    try {
      relativeInput(path);
    } catch {
      gaps.push({ kind: 'INVALID_PATH_REFERENCE', id, path, reason });
      return;
    }
    if (!localFile(path)) gaps.push({ kind: 'STALE_PATH_REFERENCE', id, path, reason });
    bind(id, path, reason);
  }

  function bindLocalSupport(caseNode, support, subject = 'this case') {
    if (!support || typeof support !== 'object' || Array.isArray(support) || !Object.keys(support).length ||
        Object.keys(support).some(key => !['fixtures', 'checks', 'contractCases'].includes(key)) ||
        Object.values(support).some(values => !Array.isArray(values) || !values.length)) {
      gaps.push({ kind:'INVALID_LOCAL_SUPPORT', id:caseNode, path:localSupportFile });
      return;
    }
    for (const path of support.fixtures ?? []) {
      if (typeof path !== 'string' || !(fixturePath.test(path) || packagedFixturePath.test(path))) {
        gaps.push({ kind:'INVALID_LOCAL_SUPPORT', id:caseNode, path:localSupportFile,
          ...(typeof path === 'string' ? { fixturePath:path } : {}), reason:'Invalid public fixture path.' });
        continue;
      }
      const id = fileId(path);
      if (localFile(path) && !nodes.has(id)) {
        put(id, path, { type:'fixture-input', qualification:'LOOKUP_ONLY',
          definitionSha256:hash(readFileSync(join(root, path))), entry:null });
      }
      link(caseNode, id, 'fixture-input', path.endsWith('.txt') ?
        'Public book file for normal fixture import.' : 'Public source file for normal fixture preparation.');
      if (!localFile(path)) {
        bind(id, path, 'missing public fixture file');
        gaps.push({ kind:'STALE_PATH_REFERENCE', id, path, reason:'Public fixture file is missing.' });
      }
    }
    for (const check of support.checks ?? []) {
      const {path, name} = check ?? {};
      if (!check || Object.keys(check).length !== 2 || typeof path !== 'string' || !localCheckPath.test(path) ||
          typeof name !== 'string' || !name.trim() || /[\u0000-\u001f]/u.test(name)) {
        gaps.push({ kind:'INVALID_LOCAL_SUPPORT', id:caseNode, path:localSupportFile, reason:'Invalid named local check.' });
        continue;
      }
      const id = 'ui-local-check:' + path + '#' + name;
      if (!nodes.has(id)) {
        const bytes = localFile(path) ? readFileSync(join(root, path)) : null;
        const literals = localTestLiterals(bytes?.toString('utf8') ?? '');
        const singleQuoted = "'" + name.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
        const matches = literals.filter(literal => literal === JSON.stringify(name) || literal === singleQuoted).length;
        put(id, path, { type:'local-check', qualification:'LOOKUP_ONLY',
          definitionSha256:bytes ? hash(bytes) : null, name,
          entry:matches === 1 ? exactLocalCheck(path, name) : null,
          constraints:'Named local verification. Select explicitly. This evidence does not grant device acceptance.' });
        if (!bytes || matches !== 1) gaps.push({ kind:bytes ? 'UNRESOLVED_LOCAL_CHECK' : 'STALE_PATH_REFERENCE',
          id, path, name, reason:'The declared test needs one identifiable literal node:test name.' });
      }
      link(caseNode, id, 'supporting-check', `Named local verification of ${subject}.`);
    }
    for (const check of support.contractCases ?? []) {
      const {path, name} = check ?? {};
      if (!check || Object.keys(check).length !== 2 || typeof path !== 'string' || !localContractPath.test(path) ||
          typeof name !== 'string' || !validCaseId.test(name)) {
        gaps.push({kind:'INVALID_LOCAL_SUPPORT',id:caseNode,path:localSupportFile,reason:'Invalid named local contract case.'});
        continue;
      }
      const id = `ui-local-contract-case:${path}#${name}`;
      if (!nodes.has(id)) {
        const bytes = localFile(path) ? readFileSync(join(root,path)) : null;
        const runnerSource = localFile(localContractRunner) ? readFileSync(join(root,localContractRunner),'utf8') : '';
        const knownRunner = /^export function selectContractCases\(definitions,\s*\{\s*argv\s*=\s*process\.argv\.slice\(2\)\s*\}\s*=\s*\{\}\)/mu
          .test(maskInactiveSource(runnerSource));
        const matches = localContractCaseNames(bytes?.toString('utf8') ?? '').filter(value => value === name).length;
        put(id,path,{type:'local-check',qualification:'LOOKUP_ONLY',definitionSha256:bytes ? hash(bytes) : null,name,
          entry:knownRunner && matches === 1 ? `node ${path} --case ${name}` : null,
          constraints:'Named local contract verification. Select explicitly and verify acceptance separately.'});
        if (!bytes || !knownRunner || matches !== 1) gaps.push({
          kind:bytes ? 'UNRESOLVED_LOCAL_CONTRACT_CASE' : 'STALE_PATH_REFERENCE',id,path,name,
          reason:'The declared case needs one literal entry wired to the known local contract selector.',
        });
        if (runnerSource) {
          if (!nodes.has(fileId(localContractRunner))) scanFile(localContractRunner);
          link(id,fileId(localContractRunner),'runtime-input','Local contract selector owns the exact --case dispatch.');
        } else bind(id,localContractRunner,'missing local contract selector');
      }
      link(caseNode,id,'supporting-check','Named local contract verification of this case.');
    }
  }

  const scopedByImporter = new Map();
  const scopedStatus = new Map();
  for (const dispatch of scopedDispatches) {
    const routes = scopedByImporter.get(dispatch.importer) ?? new Map();
    routes.set(dispatch.dependency, dispatch);
    scopedByImporter.set(dispatch.importer, routes);
    const outer = scopedByImporter.get(dispatch.outerDispatch)?.get(dispatch.importer);
    const outerVerified = !dispatch.outerDispatch || scopedStatus.get(outer) === true;
    const verified = outerVerified && localFile(dispatch.importer) && localFile(dispatch.dependency) &&
      agreesWithScopedDispatch(dispatch, readFileSync(join(root, dispatch.importer), 'utf8'),
        dispatch.guard ? readFileSync(join(root, dispatch.dependency), 'utf8') : '');
    scopedStatus.set(dispatch, verified);
  }
  const reportedDispatchGaps = new Set();
  function reportDispatchGap(dispatch) {
    if (reportedDispatchGaps.has(dispatch)) return;
    reportedDispatchGaps.add(dispatch);
    gaps.push({ kind: 'UNVERIFIED_SCOPED_DISPATCH', id: fileId(dispatch.dependency), path: dispatch.importer,
      dependency: fileId(dispatch.dependency), reason: `Review the ${dispatch.branch} call site; a recognized branch could not be established.` });
  }

  function bindReplayInput(path) {
    const id = fileId(path);
    if (localFile(path) && !nodes.has(id)) {
      put(id, path, { type:'tool-input', qualification:'LOOKUP_ONLY', definitionSha256:hash(readFileSync(join(root, path))) });
    } else if (!localFile(path)) bind(id, path, 'missing replay input');
  }

  function declareReplayLockInput(source) {
    // Both live and relocated replay read the lock relative to the tool root.
    if (!/^export const toolRoot = new URL\('\.\.\/', import\.meta\.url\);$/mu.test(source)) return undefined;
    const inventory = source.match(/^export function replayToolFiles\(root = toolRoot\) \{\r?\n[\s\S]*?^\}/mu);
    const read = inventory?.[0].match(/^  const lock = JSON\.parse\(readFileSync\((new URL\('package-lock\.json', root\)), 'utf8'\)\);$/mu);
    if (!read || /\broot\s*=(?!=)/u.test(inventory[0].slice(inventory[0].indexOf('\n'), read.index))) return undefined;
    bindReplayInput(replayLockFile);
    link(fileId(caseLoader), fileId(replayLockFile), 'replay-tool-input', 'the replay tool reads this lock relative to its supplied tool root');
    if (!localFile(replayLockFile)) gaps.push({ kind:'MISSING_DEFINITION', id:fileId(caseLoader), path:replayLockFile });
    return inventory.index + read.index + read[0].indexOf(read[1]);
  }

  function declareSchemaRuntime(source) {
    const implementation = source.match(/^export function schemaValidator\(\) \{\r?\n[\s\S]*?^\}/mu)?.[0];
    const version = implementation?.match(/^  if \(metadata\.version !== '(\d+\.\d+\.\d+)'\) throw Error\(/mu)?.[1];
    if (!version || !source.includes("import { resolveEtsLoaderRoot } from '../lib/tool-environment.mjs';") ||
        !implementation.includes('const require = createRequire(import.meta.url);') ||
        !implementation.includes("const packageRoot = resolve(resolveEtsLoaderRoot(), 'node_modules/ajv');") ||
        !implementation.includes('const Ajv = require(packageRoot);') ||
        !implementation.includes("const metadata = require(resolve(packageRoot, 'package.json'));")) return [];
    schemaRuntime = `runtime:deveco-ets/ajv@${version}`;
    put(schemaRuntime, schemaLibrary, {type:'runtime-dependency', name:'ajv', provider:'DevEco ETS loader', version,
      qualification:'LOOKUP_ONLY', definitionSha256:hash(implementation), constraints:evidenceLimit});
    return ['packageRoot', "resolve(packageRoot, 'package.json'"];
  }

  function declareCapsuleModelInputs(source) {
    const readerImport = './capsule-model-inputs.mjs';
    if (!localModuleReferences(source).paths.includes(readerImport)) return undefined;
    const id = fileId(capsuleFile);
    const exporter = localFile(caseLoader) ? readFileSync(join(root, caseLoader), 'utf8') : '';
    const exportReadsPins = exporter.includes(`import { readCapsuleModelInputs } from '${readerImport}';`) &&
      exporter.includes('tracked.push(...readCapsuleModelInputs(root).map(path => `../../${path}`));');
    bindReplayInput(capsuleModelsFile);
    link(id, fileId(capsuleModelsFile), 'model-input', 'capsule sampling and replay use the same model declaration');
    if (exportReadsPins) link(fileId(caseLoader), fileId(capsuleModelsFile), 'replay-tool-input',
      'replay export and fingerprint read the model declaration from the tool root');
    else gaps.push({ kind:'UNVERIFIED_CAPSULE_EXPORT_INPUTS', id, path:caseLoader,
      reason:'The replay export input declaration is missing or no longer recognizable.' });
    const definition = openDefinition(capsuleModelsFile, true);
    let paths;
    try {
      paths = capsuleModelInputPaths(definition);
    } catch (error) {
      gaps.push({ kind:'INVALID_CAPSULE_MODEL_INPUTS', id, path:capsuleModelsFile, reason:error.message });
      return undefined;
    }

    const symbols = source.match(/\bcapsuleModelInputs\b/gu) ?? [];
    const reader = localFile(capsuleInputReader) ? readFileSync(join(root, capsuleInputReader), 'utf8') : '';
    const readerUsesDeclaration = reader.includes(`export const capsuleModelInputFile = '${capsuleModelInputFile}';`) &&
      reader.includes("return capsuleModelInputPaths(JSON.parse(readFileSync(new URL(capsuleModelInputFile, root), 'utf8')));");
    const samplerBody = [
      'for (const path of capsuleModelInputs) {',
      'const captured = candidate?.ownerSources?.[path];',
      `const actual = sha256(readFileSync(new URL(${capsuleLoadExpression}, import.meta.url)));`,
      "if (actual !== (typeof captured === 'string' ? captured : captured?.sha256)) return null;",
      '}',
      // Keep the expected text distinct from a computed call in this source file.
      `const [sample, timeline, timing] = capsuleModelInputs.map(path => ${'require'}(${capsuleLoadExpression}));`,
    ].join(' ');
    let closed = readerUsesDeclaration && symbols.length === 3 &&
      source.includes(`import { readCapsuleModelInputs } from '${readerImport}';`) &&
      source.includes('export const capsuleModelInputs = Object.freeze(readCapsuleModelInputs());') &&
      source.replace(/\s+/gu, ' ').includes(samplerBody);
    for (const path of paths) {
      bindReplayInput(path);
      link(id, fileId(path), 'model-input', 'capsule evaluator checks this production source against the candidate before sampling');
      if (exportReadsPins) link(fileId(caseLoader), fileId(path), 'replay-tool-input',
        'replay export includes the candidate-bound model source');
      if (!localFile(path)) {
        gaps.push({ kind:'MISSING_CAPSULE_MODEL_INPUT', id, path, reason:'A declared production model source is absent.' });
        closed = false;
        continue;
      }
      const runtimeImports = localModuleReferences(readFileSync(join(root, path), 'utf8'));
      for (const reference of runtimeImports.paths) {
        const target = posix.normalize(posix.join(posix.dirname(path), reference));
        if (paths.includes(target)) {
          link(fileId(path), fileId(target), 'model-input', 'production capsule model imports another declared source');
          continue;
        }
        gaps.push({ kind:'UNDECLARED_CAPSULE_MODEL_IMPORT', id, path, dependency:fileId(target),
          reason:'The production model import is outside the replay declaration.' });
        closed = false;
        if (!target.startsWith('../') && /\.(?:[cm]?js|ts|ets|json)$/u.test(target)) {
          bindReplayInput(target);
          link(fileId(path), fileId(target), 'model-input', 'production capsule model imports an undeclared source');
        }
      }
      if (runtimeImports.unresolved) {
        gaps.push({ kind:'DYNAMIC_REFERENCE', id, path, reason:'The production capsule model has a computed import.' });
        closed = false;
      }
      for (const reference of runtimeImports.external) {
        gaps.push({ kind:'UNDECLARED_CAPSULE_MODEL_IMPORT', id, path, reference,
          reason:'An external runtime import is outside the capsule replay declaration.' });
        closed = false;
      }
    }
    // Only the single require call over the declared list has an exact mapping.
    return closed ? capsuleLoadExpression : undefined;
  }

  function scanFile(file) {
    if (scanned.has(file)) return;
    scanned.add(file);
    const id = fileId(file);
    if (!localFile(file)) return;
    const bytes = readFileSync(join(root, file));
    put(id, file, { type: 'tool-file', qualification: 'LOOKUP_ONLY', definitionSha256: hash(bytes),
      entry: consumerEntries.get(file), constraints: consumerEntries.has(file) ? evidenceLimit : undefined });
    const source = bytes.toString('utf8');
    const capsuleCall = file === capsuleFile ? declareCapsuleModelInputs(source) : undefined;
    const declaredCalls = file === schemaLibrary ? declareSchemaRuntime(source) : capsuleCall ? [capsuleCall] : [];
    const boundUrlIndex = file === caseLoader ? declareReplayLockInput(source) : undefined;
    const { paths, unresolved } = localModuleReferences(source, { declaredCalls, boundUrlIndex });
    if (unresolved) gaps.push({ kind: 'DYNAMIC_REFERENCE', id, path: file,
      reason: 'Computed module input or file URL base needs an explicit mapping.' });
    for (const path of paths) {
      const target = posix.normalize(posix.join(posix.dirname(file), path));
      // Follow acceptance tooling itself. Production imports, package loading
      // and the build/device pipelines are represented by their entry path.
      const inside = target === impactReaderFile || target.startsWith(`${ui}/`) || target.startsWith('tools/page-structure/');
      if (file === receiptFile && evaluatorFiles.has(target)) continue;
      if (target.startsWith('../') || !/\.(?:[cm]?js|ts|ets|json)$/u.test(target)) {
        gaps.push({ kind: 'DYNAMIC_REFERENCE', id, path: file, reason: `Unresolved local module ${path}` });
        continue;
      }
      if (inside && target.endsWith('.mjs')) {
        scanFile(target);
      } else if (!nodes.has(fileId(target)) && localFile(target)) {
        bindReplayInput(target);
      }
      if (target === schemaLibrary && schemaRuntime) {
        const use = schemaValidatorUses(source,file);
        if (use?.known) {
          link(id, schemaRuntime, 'runtime-input', 'schemaValidator checks this runtime package version before validation');
          for (const schema of use.paths) {
            const schemaId = fileId(schema);
            if (!localFile(schema)) gaps.push({kind:'MISSING_DEFINITION',id,path:schema,reason:`The Schema compiled by ${file} is missing.`});
            else if (!nodes.has(schemaId)) bindReplayInput(schema);
            link(id,schemaId,'model-input',`literal Schema compiled by ${file}`);
          }
        }
        if (use?.unknown) {
          gaps.push({kind:'DYNAMIC_REFERENCE',id,path:file,reason:'An imported schemaValidator use has no recognized validation call.'});
        }
      }
      const dispatch = scopedByImporter.get(file)?.get(target);
      if (dispatch && scopedStatus.get(dispatch)) {
        link(id, fileId(target), 'scoped-module-use', `module load dependency for the ${dispatch.branch} dispatch`);
      } else {
        if (dispatch) reportDispatchGap(dispatch);
        link(id, fileId(target), 'implementation-use', `local module/file reference in ${file}`);
      }
    }
  }

  const model = openDefinition(modelFile);
  const register = openDefinition(registerFile);
  const { byId: caseIds, issues: registrationIssues } =
    readCaseRegistrations(path => openDefinition(`${ui}/${path}`, true));
  const invalidRegistrations = new Set(registrationIssues.map(issue => issue.id));
  for (const issue of registrationIssues) {
    const id = typeof issue.id === 'string' ? caseId(issue.id) : undefined;
    const path = `${ui}/${issue.path}`;
    gaps.push({ kind: 'INVALID_CASE_REGISTRATION', ...issue, id, path });
    if (caseIds.has(issue.id)) bind(id, path, 'conflicting case selection registry');
  }
  const contracts = new Map();
  for (const file of readdirSync(join(root, caseDir)).sort()) {
    const id = file.slice(0, -5);
    const path = `${caseDir}/${file}`;
    if (caseRegistries.includes(path) || !file.endsWith('.json')) continue;
    const contract = openDefinition(path, true);
    if (contract === undefined) continue;
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      gaps.push({ kind: 'INVALID_CASE_DISPATCH_INPUT', id: caseId(id), path,
        reason: 'The case definition must be an object.' });
      continue;
    }
    if (!validCaseId.test(id) || id !== contract.id) {
      gaps.push({ kind: 'INVALID_CASE_IDENTITY', id, path });
      continue;
    }
    if ([contract.steps, contract.assertions].some(list => !Array.isArray(list) ||
        list.some(item => !item || typeof item !== 'object' || Array.isArray(item))) ||
        (contract.ownerSources !== undefined && !Array.isArray(contract.ownerSources))) {
      gaps.push({ kind: 'INVALID_CASE_DISPATCH_INPUT', id: caseId(id), path,
        reason: 'The case steps, assertions or owner sources cannot establish a dispatch relationship.' });
      continue;
    }
    contracts.set(id, contract);
    const registration = caseIds.get(id);
    const registered = registration && !invalidRegistrations.has(id) && contract.phase === registration.phase;
    const node = caseId(id);
    put(node, path, {
      type: 'ui-case', qualification: registered ? 'EXPLICIT_CASE' : 'UNREGISTERED',
      page: contract.pageId, version: contract.version, definitionSha256: definitionIdentities[path],
      entry: registered ? `node ${ui}/cli.mjs --case ${id} --dry-run` : null,
      constraints: registered ? 'Specify the candidate, evidence or approved live inputs separately. Coverage requires matching evidence and model obligations.' :
        'Definition exists without a registered execution selector.',
    });
    if (!registration) gaps.push({ kind: 'UNREGISTERED_CASE', id: node, path });
    else if (!registered) gaps.push({ kind: 'INVALID_CASE_REGISTRATION', id: node, path,
      reason: 'The case phase or uniqueness does not match its registry.' });
    for (const source of contract.ownerSources ?? []) useSource(node, source, 'case ownerSources (file scope)');
    for (const assertion of contract.assertions ?? []) {
      for (const reference of typeof assertion.source === 'string' ? assertion.source.split(';') : []) {
        const ref = reference.trim();
        if (ref.includes('/')) {
          useSource(node, ref, `assertion ${assertion.id}`);
        } else if (ref) {
          const name = ref.split('#')[0];
          const owners = (contract.ownerSources ?? []).filter(owner => posix.basename(owner, posix.extname(owner)) === name);
          if (owners.length === 1) useSource(node, owners[0], `assertion ${assertion.id}: ${ref} resolved by ownerSources`);
          else gaps.push({ kind: 'UNRESOLVED_SOURCE_REFERENCE', id: node, path, reference: ref, assertion: assertion.id });
        }
      }
      const evaluator = `${ui}/lib/${assertion.evaluator}.mjs`;
      if (!evaluatorFiles.has(evaluator)) {
        gaps.push({ kind: 'UNRESOLVED_EVALUATOR', id: node, path, assertion: assertion.id, evaluator: assertion.evaluator });
      } else {
        scanFile(evaluator);
        link(node, fileId(evaluator), 'implementation-use', `evaluator for ${assertion.id}`);
      }
      for (const dispatch of scopedDispatches) {
        if (!dispatch.matches(assertion)) continue;
        scanFile(dispatch.dependency);
        if (!localFile(dispatch.dependency)) {
          bind(fileId(dispatch.dependency), dispatch.dependency, 'missing assertion dispatch module');
        }
        if (!scopedStatus.get(dispatch)) reportDispatchGap(dispatch);
        link(node, fileId(dispatch.dependency), 'implementation-use',
          `${dispatch.branch} dispatch for ${assertion.id}`);
      }
    }
    for (const step of contract.steps ?? []) {
      useSource(node, step.stateWaitSource, `state observation for ${step.id}`);
      if (step.op === 'grabberReversal') {
        const dispatch = `${ui}/collectors/harmonyos/reversal-dispatch.mjs`;
        scanFile(dispatch);
        link(node, fileId(dispatch), 'implementation-use', 'Bind the Runner command receipt to the measured one-finger action.');
        const admission = `${ui}/collectors/harmonyos/runner-collection-admission.mjs`;
        scanFile(admission);
        for (const [path, reason] of [
          ['scripts/hap-pipeline.mjs', 'The independent Runner uses the canonical verify-runner and install-runner entries.'],
          ['scripts/lib/runner-installed-metadata.mjs', 'Deployment and the near-action probe share the redacted installed feature identity.'],
          [admission, 'The reversal collector replays the independently pinned dry qualification before allowing dispatch.'],
          ['tools/reader-control-device-probe.mjs', 'Runner installed identity and clock share the current lease. Pure check: node tools/reader-control-device-probe.mjs --self-test=runner-readbacks'],
        ]) {
          bindReplayInput(path);
          useSource(node,path,reason);
          link(node,fileId(path),'replay-tool-input',reason);
        }
        link(node,fileId('tools/reader-control-device-probe.mjs'),'implementation-use',
          'Runner invocation is scoped to one admitted probe mode. Pure check: node tools/reader-control-device-probe.mjs --self-test=runner-invocation');
        const guide = `${ui}/collectors/harmonyos/pointer-matrix-runner/README.md`;
        const guideReason = 'Operator guide for the same independent Runner artifact, install receipt and readbacks.';
        useSource(node,guide,guideReason);
        if (localFile(guide) && !nodes.has(fileId(guide))) {
          put(fileId(guide),guide,{type:'documentation',qualification:'LOOKUP_ONLY',
            definitionSha256:hash(readFileSync(join(root,guide)))});
        }
        link(node,fileId(guide),'documentation',guideReason);
        for (const input of grabberReversalRunnerInputs) {
          const source = `${ui}/${input}`;
          const reason = 'Source-only UiTest runner for the measured one-finger path; live dispatch requires separate verification.';
          bindReplayInput(source);
          useSource(node, source, reason);
          link(node, fileId(source), 'replay-tool-input', reason);
        }
      }
    }
    if (id === 'bookshelf.search-retry-success') {
      for (const [path, reason] of [
        [`${ui}/fixtures/search-retry-recovery/fixture.mjs`, 'Run-scoped public recovery handler returns the pinned responses.'],
        [`${ui}/fixtures/search-retry-recovery/README.md`, 'Operator guide for the separately hosted recovery fixture.'],
      ]) {
        bindReplayInput(path);
        useSource(node,path,reason);
        link(node,fileId(path),'replay-tool-input',reason);
      }
    }
    if (contract.fixture?.publicDocument) {
      const guide = `${ui}/README.md`;
      bindReplayInput(guide);
      useSource(node,guide,'Target-scoped public document attestation and native system picker collection.');
      link(node,fileId(guide),'documentation','Public document preparation and archival check entry.');
    }
    link(node, fileId(`${ui}/cli.mjs`), 'implementation-use', 'named UI capture and replay entry');
    link(node, fileId(`${ui}/schema/evidence.json`), 'implementation-use', 'case and evidence schema');
    link(fileId(coverageFile), node, 'evidence-consumer', 'explicitly selected case in coverage');
    link(fileId(exportFile), node, 'archive-consumer', 'replay export includes the case definition');
    if (registration) bind(node, `${ui}/${registration.path}`, 'case selection registry');
  }
  const declarations = openDefinition(localSupportFile, true);
  let registrationCoverageSupport = {};
  if (declarations !== undefined) {
    put(fileId(localSupportFile), localSupportFile, {type:'tool-input', qualification:'LOOKUP_ONLY',
      definitionSha256:definitionIdentities[localSupportFile], entry:null});
    const scopedSupport = Object.hasOwn(declarations ?? {},'registrationCoverage') ? declarations.registrationCoverage : {};
    if (declarations?.schemaVersion !== 1 || !declarations.cases ||
        typeof declarations.cases !== 'object' || Array.isArray(declarations.cases) ||
        !scopedSupport || typeof scopedSupport !== 'object' || Array.isArray(scopedSupport) ||
        Object.keys(declarations).some(key => !['schemaVersion','cases','registrationCoverage'].includes(key))) {
      gaps.push({ kind:'INVALID_LOCAL_SUPPORT', path:localSupportFile });
    } else {
      registrationCoverageSupport = scopedSupport;
      for (const [id,support] of Object.entries(declarations.cases)) {
        const node = caseId(id);
        bind(node, localSupportFile, 'Declared public fixture and local check relationships.');
        if (!contracts.has(id) || !caseIds.has(id)) {
          gaps.push({ kind:'UNRESOLVED_LOCAL_SUPPORT_CASE', id:node, path:localSupportFile });
        }
        bindLocalSupport(node, support);
      }
    }
  }
  for (const [id, registration] of caseIds) {
    if (!contracts.has(id)) {
      const path = `${caseDir}/${id}.json`;
      gaps.push({ kind: 'MISSING_REGISTERED_CASE', id: caseId(id), path, reason: 'Case selection registry still refers to this definition.' });
      link(fileId(coverageFile), caseId(id), 'evidence-consumer', 'registered case in coverage');
      for (const dependency of scopedDependencies) {
        if (localFile(dependency)) link(caseId(id), fileId(dependency), 'implementation-use',
          'registered case is unavailable, so its dispatch cannot be excluded');
      }
      bind(caseId(id), path, 'registered case path that no longer resolves');
      bind(caseId(id), `${ui}/${registration.path}`, 'case selection registry');
    }
  }

  for (const layer of model.layers ?? []) {
    put(`page-layer:${layer.id}`, modelFile, { type: 'page-layer', qualification: 'MODEL', definitionSha256: hash(JSON.stringify(layer)) });
  }
  for (const invariant of model.invariants ?? []) {
    const id = `page-invariant:${invariant.id}`;
    put(id, modelFile, { type: 'page-invariant', qualification: 'MODEL', definitionSha256: hash(JSON.stringify(invariant)) });
    link(id, `page-layer:${invariant.layer}`, 'model-reference', 'invariant belongs to this page layer');
  }
  for (const constraint of model.illegalCombinations ?? []) {
    const id = `page-constraint:${constraint.id}`;
    put(id, modelFile, { type: 'page-constraint', qualification: 'MODEL', definitionSha256: hash(JSON.stringify(constraint)) });
    link(id, `page-layer:${constraint.layer}`, 'model-reference', 'constraint belongs to this page layer');
  }
  const obligations = new Map((model.scenarioObligations ?? []).map(item => [item.caseId, item]));
  const sharedSourceActions = new Map();
  const structureAction = (caseName, role) => sharedSourceActions.get(caseName)?.get(role) ?? obligations.get(caseName)?.actions?.[role];
  const ruleTable = model.structureRules ?? [];
  for (const [key, selector] of Object.entries(model.structureSelectors ?? {})) {
    const id = selectorId(key);
    put(id, modelFile, { type: 'structure-selector', qualification: 'MODEL', definitionSha256: hash(JSON.stringify(selector)) });
    for (const name of ['under', 'ancestorOf']) {
      if (selector[name]) link(id, selectorId(selector[name]), 'observation-mapping', `selector ${name} reference`);
    }
  }
  for (const rule of ruleTable) {
    const node = ruleId(rule.id);
    put(node, modelFile, { type: 'structure-rule', qualification: 'MODEL', layer: rule.layer,
      definitionSha256: hash(JSON.stringify(rule)), basis: rule.basis });
    link(node, `page-layer:${rule.layer}`, 'model-reference', 'structure rule belongs to this page layer');
    link(node, fileId(`${ui}/lib/structure.mjs`), 'implementation-use', 'shared structure evaluator');
    link(node, fileId(`${ui}/lib/structure-contract.mjs`), 'implementation-use', 'shared structure definition loader and validation');
    for (const required of rule.requires ?? []) {
      link(node, ruleId(required), 'required', 'required by the shared model rule', { scope: 'same-full-sample' });
    }
    for (const check of rule.checks ?? []) {
      for (const name of ['node', 'ancestor', 'behind']) {
        if (check[name]) link(node, selectorId(check[name]), 'observation-mapping', `${check.kind} ${name} selector`);
      }
    }
  }
  const ruleVisits = new Set();
  const activeRules = new Set();
  function visitRule(id) {
    if (activeRules.has(id)) {
      gaps.push({ kind: 'REQUIRED_DEPENDENCY_CYCLE', id, chain: [...activeRules, id] });
      return;
    }
    if (ruleVisits.has(id)) return;
    ruleVisits.add(id);
    activeRules.add(id);
    for (const edge of upstream.get(id) ?? []) if (edge.kind === 'required') visitRule(edge.dependency);
    activeRules.delete(id);
  }
  for (const rule of ruleTable) visitRule(ruleId(rule.id));
  for (const [rule, declared] of Object.entries(model.structureFoundations ?? {})) {
    const consumer = ruleId(rule);
    if (!nodes.has(consumer)) gaps.push({ kind: 'STALE_FOUNDATION_OWNER', id: consumer, path: modelFile });
    if (!Array.isArray(declared) || !declared.length || new Set(declared).size !== declared.length) {
      gaps.push({ kind: 'INVALID_FOUNDATION_DECLARATION', id: consumer, path: modelFile });
      continue;
    }
    const implemented = collectReachable([consumer], current =>
      (upstream.get(current) ?? []).filter(edge => edge.kind === 'required').map(edge => edge.dependency));
    implemented.delete(consumer);
    for (const foundation of declared) {
      const dependency = ruleId(foundation);
      // Keep the declared obligation visible even if its implemented path was removed.
      link(consumer, dependency, 'required-foundation', 'independently declared necessary foundation', { scope: 'same-full-sample' });
      if (!implemented.has(dependency)) {
        gaps.push({ kind: 'FOUNDATION_NOT_IN_REQUIRED_CLOSURE', id: consumer, dependency, path: modelFile });
      }
    }
  }
  for (const obligation of model.scenarioObligations ?? []) {
    const node = `scenario:${obligation.caseId}`;
    const consumer = caseId(obligation.caseId);
    const contract = contracts.get(obligation.caseId);
    put(node, modelFile, { type: 'scenario-obligation', qualification: 'MODEL', definitionSha256: hash(JSON.stringify(obligation)) });
    link(node, consumer, 'required-evidence', 'scenario obligation requires a matching case and evidence', { scope: 'case-evidence' });
    link(fileId(coverageFile), node, 'evidence-consumer', 'model obligation establishes the coverage denominator');
    if (localFile(receiptStructure)) link(fileId(receiptStructure), node, 'evidence-consumer',
      'receipt binds and evaluates each scenario role');
    if (localFile(reassessmentFile)) link(fileId(reassessmentFile), node, 'evidence-consumer',
      'original-receipt structural reassessment');
    if (!contract) bind(node, `${caseDir}/${obligation.caseId}.json`, 'missing case referenced from model obligation');
    if (usesSourceUnknownExpand(contract) && isDeepStrictEqual(contract.steps, sourceUnknownExpandSteps)) {
      try {
        const bindings = resolveStructureBindings(contract, model);
        sharedSourceActions.set(obligation.caseId, new Map(bindings.map(({role,actionId}) => [role,actionId])));
      } catch {
        // Keep the ordinary diagnostics for a broken shared capture binding.
      }
    }
    const fullSamples = new Map((contract?.steps ?? []).filter(step => step?.kind === 'sample').map(step => [step.id, step]));
    const stepMatches = new Map();
    for (const [index, step] of (contract?.steps ?? []).entries()) {
      if (!step || typeof step !== 'object') continue;
      const matches = stepMatches.get(step.id) ?? [];
      matches.push({ step, index });
      stepMatches.set(step.id, matches);
    }
    const coveredSamples = new Map();
    const roleBindings = new Map();
    for (const [role, required] of Object.entries(obligation.states ?? {})) {
      const sample = Object.hasOwn(contract?.structure ?? {}, role) ? contract.structure[role] : undefined;
      const expectedAction = structureAction(obligation.caseId, role);
      const sampleStep = fullSamples.get(sample);
      const sampleMatches = stepMatches.get(sample) ?? [];
      const actionMatches = stepMatches.get(expectedAction) ?? [];
      const valid = sampleStep && sampleMatches.length === 1 && Object.hasOwn(obligation.actions ?? {}, role) &&
        (sampleStep.afterAction ?? null) === expectedAction && (expectedAction === null ||
          (actionMatches.length === 1 && actionMatches[0].step.kind === 'action' && actionMatches[0].index < sampleMatches[0].index));
      const reason = `required scenario role ${role}${sample ? `, sample ${sample}` : ''}`;
      const binding = { scope: 'scenario-full-sample', role, sampleId: sample ?? null, actionId: expectedAction ?? null };
      link(node, ruleId(required), 'required', reason, binding);
      link(consumer, ruleId(required), 'required', reason, binding);
      roleBindings.set(role, { required, binding, valid });
      if (!valid) {
        gaps.push({ kind: 'MISSING_OR_WRONG_ROLE_BINDING', id: consumer, role, sample: sample ?? null,
          rule: ruleId(required), expectedAction });
      }
      if (sampleStep) {
        if (coveredSamples.has(sample)) gaps.push({ kind: 'DUPLICATE_ROLE_SAMPLE', id: consumer,
          role, sample, earlierRole: coveredSamples.get(sample) });
        coveredSamples.set(sample, role);
      }
    }
    if (!sharedSourceActions.has(obligation.caseId)) {
      for (const sample of fullSamples.keys()) {
        if (!coveredSamples.has(sample)) gaps.push({ kind: 'UNMAPPED_FULL_SAMPLE', id: consumer, sample });
      }
    }
    for (const role of Object.keys(obligation.actions ?? {})) {
      if (!Object.hasOwn(obligation.states ?? {}, role)) gaps.push({ kind: 'UNDECLARED_ACTION_ROLE', id: consumer, role });
    }
    const rawConditions = obligation.conditions;
    const conditionMap = rawConditions && typeof rawConditions === 'object' && !Array.isArray(rawConditions)
      ? rawConditions : null;
    const conditionIds = Object.values(conditionMap ?? {});
    const validConditionMap = conditionIds.length > 0 && new Set(conditionIds).size === conditionIds.length;
    if (rawConditions !== undefined && !validConditionMap) {
      gaps.push({ kind: 'INVALID_CONDITION_MAP', id: consumer, path: modelFile,
        reason: 'A conditions object must identify at least one role and use each assertion ID once.' });
    }
    const declared = new Set();
    const assertions = contract?.assertions ?? [];
    const conditions = validConditionMap ? conditionMap : {};
    const roles = new Set([...Object.keys(conditions), ...Object.keys(obligation.conditionalEndpoints ?? {})]);
    for (const role of roles) {
      const { conditionId: assertionId, conditionalEndpoint } =
        resolveStructureCondition({ ...obligation, conditions }, role, contract?.version);
      if (assertionId === undefined) continue;
      const roleBinding = roleBindings.get(role);
      if (!roleBinding) {
        gaps.push({ kind: 'UNDECLARED_CONDITION_ROLE', id: consumer, role });
        continue;
      }
      if (typeof assertionId !== 'string' || !validAssertionId.test(assertionId)) {
        gaps.push({ kind: 'INVALID_CONDITION_ASSERTION_ID', id: consumer, role, assertionId });
        continue;
      }
      declared.add(assertionId);
      const matches = assertions.filter(assertion => assertion.id === assertionId);
      const assertion = matches[0];
      const { required, binding, valid } = roleBinding;
      if (!valid || matches.length !== 1 || assertion.required !== false ||
          typeof assertion.condition !== 'string' || !assertion.condition.trim() ||
          assertion.sample !== binding.sampleId || (assertion.action ?? null) !== binding.actionId) {
        gaps.push({ kind: 'UNRESOLVED_CONDITION_BINDING', id: consumer, role, assertionId,
          sample: binding.sampleId, expectedAction: binding.actionId,
          reason: 'A role condition must name a unique optional conditional assertion for the same full sample and action.' });
        continue;
      }
      const metadata = { ...binding, assertionId, ...(conditionalEndpoint ? { conditionalEndpoint: true } : {}) };
      const reason = `assertion applicability controls the ${conditionalEndpoint ? 'full structural endpoint' : 'structural leaf'} for role ${role}`;
      link(node, ruleId(required), 'condition-applicability', reason, metadata);
      link(consumer, ruleId(required), 'condition-applicability', reason, metadata);
    }
    for (const assertion of assertions) {
      const needsConditionalRole = (assertion.evaluator === 'source' && conditionBoundSourceKinds.includes(assertion.kind)) ||
        (assertion.evaluator === 'search' && assertion.kind === 'phase-history-loading');
      if (needsConditionalRole &&
          !declared.has(assertion.id)) {
        gaps.push({ kind: 'MISSING_CONDITION_BINDING', id: consumer, assertionId: assertion.id,
          sample: assertion.sample, expectedAction: assertion.action, path: modelFile });
      }
    }
  }
  for (const [id, contract] of contracts) {
    const wanted = obligations.get(id)?.states ?? {};
    for (const role of Object.keys(contract.structure ?? {})) {
      if (!Object.hasOwn(wanted, role)) gaps.push({ kind: 'UNDECLARED_ROLE', id: caseId(id), role });
    }
    if (contract.phase === 1 && !obligations.has(id)) gaps.push({ kind: 'SCENARIO_OBLIGATION_UNMAPPED', id: caseId(id),
      path: `${caseDir}/${id}.json`, reason: 'Existing case has no structure obligation in the current model.' });
  }

  for (const page of register.pages ?? []) {
    const id = `registered-page:${page.pageId}`;
    put(id, registerFile, { type: 'registered-page', qualification: 'EVIDENCE_REQUIRED',
      definitionSha256: hash(JSON.stringify(page)), entry: `node ${registrationEntry}` });
    useSource(id, page.source?.path, 'registered page source');
    for (const source of page.sourceInputs ?? []) useSource(id, source.path, 'registered page source input');
    for (const layer of Object.keys(page.layers ?? {})) link(id, `page-layer:${layer}`, 'model-reference', 'page layer registration');
    for (const invariant of Object.keys(page.invariants ?? {})) {
      link(id, `page-invariant:${invariant}`, 'model-reference', 'page invariant registration');
    }
    link(fileId(registrationEntry), id, 'evidence-consumer', 'register checks the registered page and evidence');
  }
  for (const mapping of model.receiptCoverageReferences ?? []) {
    const id = `registration-coverage:${mapping.pageId}/${mapping.claim}`;
    const invariant = mapping.claim?.split('.')[1];
    const page = register.pages?.find(item => item.pageId === mapping.pageId);
    const basisPath = mapping.basisInput?.path;
    const targetInventory = mapping.basisInput?.kind === 'target-inventory';
    const layoutMatrix = mapping.basisInput?.kind === 'layout-matrix';
    const basis = typeof basisPath === 'string' && /^tools\/page-structure\/[a-zA-Z0-9_-]+\.json$/u.test(basisPath)
      ? openDefinition(basisPath, true) : undefined;
    const inventoryTargets = targetInventory && Array.isArray(basis?.targets) ? basis.targets : [];
    const targetIds = inventoryTargets.map(target => target?.id);
    const gestureIds = targetInventory && Array.isArray(basis?.gestures) ? basis.gestures.map(gesture=>gesture?.id) : [];
    const validIds = ids => ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length;
    const validAxis = values => Array.isArray(values) && values.length > 0 &&
      values.every(value => Number.isFinite(value) && value > 0) && new Set(values).size === values.length;
    const fontWindows = layoutMatrix && validAxis(basis?.widths) && validAxis(basis?.fontScales)
      ? basis.widths.flatMap(widthVp => basis.fontScales.map(fontScale => ({widthVp,fontScale}))) : [];
    const matchedTargets = new Set();
    const matchedGestures = new Set();
    const sourceTouchReferences = new Map();
    const textWindows = [];
    const coverage = {remaining:mapping.remaining};
    if (isSourceE2Claim(mapping,mapping.claim) || isSourceE3Claim(mapping,mapping.claim)) {
      const reason = sourceE2AdmissionGap(mapping,mapping.claim,model) ?? sourceE3AdmissionGap(mapping,mapping.claim,model);
      coverage.formalAdmission = reason ? {status:'UNAVAILABLE',reason} : {status:'EVIDENCE_REQUIRED'};
      if (localFile(registrationAdapter)) {
        scanFile(registrationAdapter);
        link(id, fileId(registrationAdapter), 'implementation-use', 'formal admission for this scoped coverage');
      }
    }
    put(id, modelFile, { type:'registration-coverage', qualification:'LOOKUP_ONLY',
      definitionSha256:hash(JSON.stringify(mapping)), coverage });
    link(id, `page-invariant:${invariant}`, 'model-reference', 'invariant whose acceptance the scoped evidence informs');
    link(id, `registered-page:${mapping.pageId}`, 'model-reference', 'page where this scoped evidence applies');
    bind(id, registerFile, 'registered page and invariant');
    if (mapping.claim !== `invariants.${invariant}` || page?.routeContractRef !== mapping.routeContractRef ||
        !page?.invariants?.[invariant] || !nodes.has(`page-invariant:${invariant}`)) {
      gaps.push({ kind:'REGISTRATION_COVERAGE_CLAIM_UNRESOLVED', id, path:registerFile });
    }
    const validBasis = basis?.pageId === mapping.pageId && (targetIds.length > 0 || fontWindows.length > 0) &&
      validIds(targetIds) && validIds(gestureIds) && (!targetInventory || basis?.gestures === undefined || Array.isArray(basis.gestures));
    if (!validBasis) {
      gaps.push({ kind:'REGISTRATION_COVERAGE_BASIS_UNRESOLVED', id, path:basisPath ?? modelFile });
    }
    if (basis) {
      bindReplayInput(basisPath);
      link(id, fileId(basisPath), 'model-input', 'existing inventory or matrix defining broader coverage');
    } else if (typeof basisPath === 'string') {
      bind(id, basisPath, 'unresolved registration coverage basis');
    }
    if (gestureIds.length && localFile(sourceGesturePolicy)) {
      scanFile(sourceGesturePolicy);
      link(id,fileId(sourceGesturePolicy),'implementation-use','binds inventory gestures to exact native cases and captures');
    }
    const parts = mapping.cases;
    if (!Array.isArray(parts) || !parts.length || parts.some(part => !validCaseId.test(part?.caseId ?? '')) ||
        new Set(parts.map(part => part.caseId)).size !== parts.length) {
      gaps.push({ kind:'REGISTRATION_COVERAGE_CASES_UNRESOLVED', id, path:modelFile });
      continue;
    }
    for (const part of parts) {
      const member = caseId(part.caseId);
      const contract = contracts.get(part.caseId);
      const validCase = caseIds.has(part.caseId) && contract?.pageId === mapping.pageId && obligations.has(part.caseId);
      link(id, member, 'scoped-receipt-reference', 'case provides a scoped observation for this invariant',
        {scope:part.scope, targetIds:part.targetIds ?? [], gestureIds:part.gestureIds ?? [], assertions:part.assertions});
      if (!validCase) {
        gaps.push({ kind:'REGISTRATION_COVERAGE_CASE_UNRESOLVED', id, case:member, path:modelFile });
      }
      const ownerSources = Array.isArray(part.ownerSources) ? part.ownerSources : [];
      const validOwners = ownerSources.length > 0 && ownerSources.every(source => contract?.ownerSources?.includes(source));
      if (!validOwners) gaps.push({ kind:'REGISTRATION_COVERAGE_OWNER_UNRESOLVED', id, case:member, path:modelFile });
      for (const source of ownerSources) {
        useSource(id, source, 'production owner of a scoped registration case');
      }
      const assertions = Array.isArray(part.assertions) ? part.assertions : [];
      let validAssertions = assertions.length > 0 &&
        new Set(assertions.map(item => item?.id)).size === assertions.length;
      if (!validAssertions) gaps.push({kind:'REGISTRATION_COVERAGE_ASSERTION_UNRESOLVED',id,case:member,path:modelFile});
      const caseTextWindows = [];
      for (const item of assertions) {
        const {id:assertionId,sampleId} = item ?? {};
        const definition = contract?.assertions?.filter(item => item.id === assertionId) ?? [];
        const assertion = definition[0];
        const roles = Object.entries(contract?.structure ?? {}).filter(([,sample]) => sample === sampleId);
        const obligation = obligations.get(part.caseId);
        const exactRecoveryTarget = assertion?.kind === 'recovery-native-control' && part.targetIds?.length === 1 &&
          inventoryTargets.some(target => target?.id === part.targetIds[0] && typeof target.controlRef === 'string' &&
            assertion.expected?.target === `reader-${target.controlRef}`);
        const conditionalTarget = targetInventory && assertion?.evaluator === 'source' && assertion.required === false &&
          typeof assertion.condition === 'string' && assertion.condition.trim() && assertion.expected?.requireNativeTouchTarget === true &&
          (['read-retry','retained-read-failure'].includes(assertion.kind) || exactRecoveryTarget) &&
          roles.some(([role]) => obligation?.conditions?.[role] === assertionId &&
            (assertion.action ?? null) === structureAction(part.caseId, role));
        const sourceTextCondition = layoutMatrix && assertion?.evaluator === 'source' && assertion.kind === 'surface-text' &&
          assertion.required === false && assertion.expected?.conditionAssertion;
        const earlier = sourceTextCondition && contract.assertions.slice(0,contract.assertions.indexOf(assertion))
          .find(candidate => candidate.id === sourceTextCondition);
        const conditionalText = earlier && earlier.evaluator === 'source' &&
          conditionBoundSourceKinds.includes(earlier.kind) && earlier.required === false &&
          assertion.condition && earlier.condition === assertion.condition && earlier.sample === sampleId &&
          earlier.action === assertion.action && roles.some(([role]) => obligation?.conditions?.[role] === earlier.id &&
            (assertion.action ?? null) === structureAction(part.caseId, role));
        const touch = targetInventory && sourceE2TouchAssertion(contract,assertion);
        const conditionalBody = (layoutMatrix && assertion?.kind === 'recovery-body-text' ||
          touch && part.targetIds?.includes(touch.subject)) && assertion?.evaluator === 'source' &&
          assertion.required === false && assertion.condition && roles.some(([role]) =>
          obligation?.conditions?.[role] === assertionId && (assertion.action ?? null) === structureAction(part.caseId, role));
        const touchTarget = touch && contract.assertions.find(candidate =>
          candidate.id === assertion.expected?.conditionAssertion);
        const conditionalTouchTarget = touch && part.targetIds?.includes(touch.subject) && touchTarget &&
          assertion?.evaluator === 'source' && assertion.required === false && assertion.condition &&
          touchTarget.sample === sampleId && roles.some(([role]) =>
            (touchTarget.action ?? null) === structureAction(part.caseId, role) &&
            (obligation?.conditions?.[role] === touchTarget.id ||
              obligation?.conditions?.[role] === undefined && touchTarget?.required === true &&
                touchTarget.kind === 'native-control-target'));
        if (definition.length !== 1 || assertion.sample !== sampleId ||
            (assertion.required !== true && !conditionalTarget && !conditionalText && !conditionalBody &&
              !conditionalTouchTarget) || !roles.length) {
          gaps.push({ kind:'REGISTRATION_COVERAGE_ASSERTION_UNRESOLVED', id, case:member, assertion:assertionId,
            sample:sampleId, path:modelFile });
          validAssertions = false;
        } else if (layoutMatrix && assertion.kind === 'adaptation-text') {
          const {requireNativeFontReadback,requireCurrentTextProjection,minWidthVp,maxWidthVp,minFontScale,maxFontScale} =
            assertion.expected ?? {};
          if (requireNativeFontReadback !== true || requireCurrentTextProjection !== true ||
              ![minWidthVp,maxWidthVp,minFontScale,maxFontScale].every(value => Number.isFinite(value) && value > 0) ||
              minWidthVp > maxWidthVp || minFontScale > maxFontScale) {
            gaps.push({kind:'REGISTRATION_COVERAGE_TEXT_WINDOW_UNRESOLVED',id,case:member,assertion:assertionId,path:modelFile});
            validAssertions = false;
          } else caseTextWindows.push({minWidthVp,maxWidthVp,minFontScale,maxFontScale});
        }
      }
      const validReference = validCase && validOwners && validAssertions;
      if (validReference && isSourceE2Claim(mapping,mapping.claim)) {
        for (const {id:assertionId} of assertions) {
          const proof = sourceE2TouchAssertion(contract,contract.assertions.find(item=>item.id === assertionId));
          if (!proof || !part.targetIds?.includes(proof.subject) || !targetIds.includes(proof.subject)) continue;
          if (!sourceTouchReferences.has(proof.subject)) sourceTouchReferences.set(proof.subject,new Set());
          sourceTouchReferences.get(proof.subject).add(proof.position);
        }
      }
      for (const targetId of Array.isArray(part.targetIds) ? part.targetIds : []) {
        if (!targetIds.includes(targetId)) {
          gaps.push({ kind:'REGISTRATION_COVERAGE_TARGET_UNRESOLVED', id, case:member, targetId, path:basisPath });
        } else if (validReference) matchedTargets.add(targetId);
      }
      for (const gestureId of Array.isArray(part.gestureIds) ? part.gestureIds : []) {
        const resolved = gestureIds.includes(gestureId) && assertions.some(reference =>
          sourceGestureAssertion(gestureId,contract,contract?.assertions?.find(item=>item.id === reference?.id)));
        if (!resolved) {
          gaps.push({kind:'REGISTRATION_COVERAGE_GESTURE_UNRESOLVED',id,case:member,gestureId,path:basisPath});
        } else if (validReference) matchedGestures.add(gestureId);
      }
      if (validReference) textWindows.push(...caseTextWindows);
    }
    if (targetInventory) coverage.inventoryTargetsWithoutReferences =
      validBasis ? targetIds.filter(target => !matchedTargets.has(target)) : null;
    if (targetInventory) coverage.inventoryGesturesWithoutReferences =
      validBasis ? gestureIds.filter(gesture => !matchedGestures.has(gesture)) : null;
    if (isSourceE2Claim(mapping,mapping.claim)) coverage.inventoryTouchWithoutReferences =
      validBasis ? sourceE2MissingTouchReferences(targetIds,sourceTouchReferences) : null;
    if (layoutMatrix) coverage.fontWindowsWithoutTextReferences = validBasis ? fontWindows.filter(({widthVp,fontScale}) =>
      !textWindows.some(expected => widthVp >= expected.minWidthVp && widthVp <= expected.maxWidthVp &&
        fontScale >= expected.minFontScale && fontScale <= expected.maxFontScale)) : null;
  }
  for (const [id,support] of Object.entries(registrationCoverageSupport)) {
    bind(id,localSupportFile,'Declared local check for this registration coverage reference.');
    if (nodes.get(id)?.type !== 'registration-coverage') {
      gaps.push({kind:'UNRESOLVED_REGISTRATION_COVERAGE_SUPPORT',id,path:localSupportFile});
    }
    if (!support || Object.keys(support).some(key => key !== 'checks')) {
      gaps.push({kind:'INVALID_LOCAL_SUPPORT',id,path:localSupportFile});
      continue;
    }
    bindLocalSupport(id,support,'this scoped registration reference');
  }
  for (const mapping of model.receiptAdmissions ?? []) {
    const id = `registration:${mapping.pageId}/${mapping.claim}`;
    const [group, claim] = mapping.claim.split('.');
    put(id, modelFile, { type: 'registration-admission', qualification: 'EVIDENCE_REQUIRED',
      definitionSha256: hash(JSON.stringify(mapping)), entry: `node ${registrationEntry}` });
    link(id, group === 'layers' ? `page-layer:${claim}` : `page-invariant:${claim}`, 'model-reference', 'claimed model item');
    if (localFile(registrationAdapter)) link(id, fileId(registrationAdapter), 'implementation-use', 'admission validates its receipt and required structure');
    link(`registered-page:${mapping.pageId}`, id, 'required-evidence', 'page register checks this evidence admission');
    bind(id, registerFile, 'registered page claim');
    const page = register.pages?.find(item => item.pageId === mapping.pageId);
    if (page?.routeContractRef !== mapping.routeContractRef) gaps.push({ kind: 'REGISTRATION_ROUTE_UNRESOLVED', id, path: registerFile });
    const parts = mapping.cases ?? [mapping];
    if (!Array.isArray(parts) || parts.length < (mapping.cases ? 2 : 1) ||
        new Set(parts.map(part => part?.caseId)).size !== parts.length) {
      gaps.push({ kind: 'REGISTRATION_CASE_GROUP_UNRESOLVED', id, path: modelFile });
      continue;
    }
    for (const part of parts) {
      if (!part?.caseId || typeof part.caseId !== 'string') {
        gaps.push({ kind: 'REGISTRATION_CASE_GROUP_UNRESOLVED', id, path: modelFile });
        continue;
      }
      const member = caseId(part.caseId);
      link(id, member, 'required-evidence', 'registration claim consumes this case and its required rule results');
      if (mapping.cases && (!Array.isArray(part.ownerSources) || !part.ownerSources.length ||
          !Array.isArray(part.assertions) || !part.assertions.length)) {
        gaps.push({ kind: 'REGISTRATION_CASE_GROUP_UNRESOLVED', id, case:member, path: modelFile });
        continue;
      }
      for (const source of part.ownerSources ?? []) useSource(id, source, 'ownerSources for registration admission');
      const contract = contracts.get(part.caseId);
      if (mapping.cases && (!contract || !caseIds.has(part.caseId) || contract.pageId !== mapping.pageId ||
          (part.ownerSources ?? []).some(path => !contract.ownerSources?.includes(path)))) {
        gaps.push({ kind: 'REGISTRATION_CASE_UNRESOLVED', id, case: member, path: modelFile });
      }
      for (const assertion of part.assertions ?? []) {
        if (!contract?.assertions?.some(item => item.id === assertion.id && item.sample === assertion.sampleId)) {
          gaps.push({ kind: 'REGISTRATION_ASSERTION_UNRESOLVED', id, case: member, assertion: assertion.id,
            sample: assertion.sampleId });
        }
      }
    }
  }
  for (const file of [
    impactEntry, impactReaderFile,
    coverageFile, registrationEntry, registrationAdapter, `${ui}/cli.mjs`, exportFile, `${ui}/reseal.mjs`, reassessmentFile, receiptStructure,
    `${ui}/lib/structure.mjs`, `${ui}/lib/structure-contract.mjs`, 'tools/page-structure/validate-model.mjs',
  ]) scanFile(file);
  for (const file of [`${ui}/schema/evidence.json`, 'tools/page-structure/schema/model.schema.json',
    'tools/page-structure/schema/register.schema.json']) {
    bindReplayInput(file);
  }
  for (const [name, inputs] of [
    [coverageFile, [modelFile, ...caseRegistries]],
    [exportFile, [modelFile, registerFile, ...caseRegistries]],
    [reassessmentFile, [modelFile, ...caseRegistries]],
    [receiptFile, [`${ui}/schema/evidence.json`]],
    ['tools/page-structure/validate-model.mjs', [modelFile, 'tools/page-structure/schema/model.schema.json']],
    [registrationEntry, [modelFile, registerFile, 'tools/page-structure/schema/register.schema.json']],
    [registrationAdapter, [modelFile, registerFile]],
  ]) {
    if (localFile(name)) for (const path of inputs) bind(fileId(name), path, `definition read by ${name}`);
  }

  const catalog = openDefinition(catalogFile);
  const resources = openDefinition(resourceManifestFile, true);
  const retired = openDefinition(retiredFile);
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries) || retired.schemaVersion !== 1 || !Array.isArray(retired.entries)) {
    throw new Error('Invalid reviewed gate index or retirement registry.');
  }
  const catalogEntries = [...catalog.entries, ...(catalog.caseEntries ?? []), ...(catalog.externalEntries ?? [])];
  const catalogFiles = new Map();
  for (const entry of catalogEntries) {
    if (!entry.file) continue;
    const entries = catalogFiles.get(entry.file) ?? [];
    entries.push(entry);
    catalogFiles.set(entry.file, entries);
  }
  for (const entry of catalogEntries) {
    const id = gateId(entry.id);
    const executable = entry.qualification === 'QUALIFIED' && catalog.reviewedDefinitionsFrozen === true;
    const resource = entry.resourceDefinitionSha256 ? {
      expected: entry.resourceDefinitionSha256,
      actual: resources ? gateResourceDefinitionSha256(resources, entry) : null,
    } : undefined;
    put(id, entry.file ?? catalogFile, {
      type: 'reviewed-gate', qualification: entry.qualification,
      definitionFile: catalogFile,
      entry: entry.entryPoint ?? (executable ? `node ${reviewedEntry} --id ${entry.id} --run --change "<actual change>"` : null),
      detail: `node ${reviewedEntry} --id ${entry.id}`,
      constraints: [entry.limitations, executable ? 'Existing execution-time definition identity and resource admission still apply.' :
        entry.repair ?? 'Not an admitted Host execution selector.'].filter(Boolean),
      definitionSha256: hash(JSON.stringify({ entry, executable, resource })),
      ...(resource ? { resourceDefinition: { path: resourceManifestFile, ...resource } } : {}),
    });
    bind(id, catalogFile, 'reviewed gate metadata');
    if (resource) bind(id, resourceManifestFile, 'reviewed resource/case declaration');
    if (entry.file && !localFile(entry.file)) {
      gaps.push({ kind: 'STALE_PATH_REFERENCE', id, path: entry.file, reason: 'reviewed test file' });
    }
    for (const path of entry.tests ?? []) bind(id, `tools/${path}`, 'reviewed test file');
    for (const input of entry.definitionInputs ?? []) bind(id, input.path, `reviewed definition input ${input.sha256}`);
    for (const path of entry.nestedCalls ?? []) {
      if (/^(?:tools|scripts|entry)\//u.test(path)) bind(id, path, 'reviewed nested call');
    }
    for (const change of changedPaths) {
      const hint = catalogBinding(change, entry.productionBinding);
      if (hint) bind(id, change, `conservative production binding ${hint}`);
    }
    for (const child of entry.focusedEntries ?? []) link(id, gateId(child), 'navigation', 'reviewed focused case');
    for (const adoption of entry.coverageAdoption ?? []) {
      const text = typeof adoption === 'string' ? adoption : adoption?.coverage ?? adoption?.protects ?? adoption?.reason;
      if (adoption?.id || adoption?.target) {
        const target = adoption.target ?? (adoption.case ? `${adoption.id}#${adoption.case}` : adoption.id);
        link(id, gateId(target), 'evidence-consumer', text ?? 'reviewed coverage adoption');
      } else if (adoption?.file) {
        const candidates = catalogFiles.get(adoption.file) ?? [];
        const selectors = Array.isArray(adoption.cases) ? adoption.cases : [adoption.case];
        for (const selector of selectors) {
          const target = candidates.find(candidate => candidate.caseId === selector);
          if (target) link(id, gateId(target.id), 'evidence-consumer', text ?? `reviewed coverage adoption of ${adoption.file}`);
          else gaps.push({ kind: 'UNRESOLVED_COVERAGE_REFERENCE', id, path: adoption.file, selector });
        }
      } else {
        gaps.push({ kind: 'UNRESOLVED_COVERAGE_REFERENCE', id, reason: text ?? 'Coverage adoption has no exact selector.' });
      }
    }
  }
  for (const entry of retired.entries) {
    const id = gateId(entry.id);
    put(id, retiredFile, { type: 'retired-gate', qualification: 'RETIRED', entry: null, constraints: retired.reason });
    bind(id, `tools/${entry.file}`, 'retired file identity');
  }
  for (const { consumer, dependency, kind, reason } of edges.values()) {
    if (!nodes.has(dependency)) gaps.push({ kind: 'STALE_ID_REFERENCE', id: consumer, dependency, relationship: kind, reason });
  }
  return { nodes, bindings, edges: [...edges.values()], upstream, downstream, gaps, definitionIdentities, localFile,
    model, obligations, contracts, caseIds };
}

function checkStructureDependencies(graph, ids) {
  const cases = new Set();
  const errors = [];
  for (const id of ids) {
    const colon = id.indexOf(':');
    const kind = id.slice(0, colon);
    const name = id.slice(colon + 1);
    if (kind === 'structure-rule' && graph.nodes.has(id)) continue;
    if (['scenario', 'ui-case'].includes(kind) && colon !== -1 && graph.obligations.has(name)) {
      cases.add(name);
    } else {
      errors.push({ id, reason: 'Select an existing structure-rule:, scenario:, or ui-case: with a structure obligation.' });
    }
  }
  const scope = { model: modelFile, selected: ids, cases: [...cases].sort() };
  let definition;
  try {
    definition = validateStructureDefinition(graph.model);
  } catch (error) {
    errors.push({ path: modelFile, reason: error.message });
  }
  for (const name of scope.cases) {
    const id = caseId(name);
    const contract = graph.contracts.get(name);
    const path = `${caseDir}/${name}.json`;
    if (!contract || !graph.caseIds.has(name)) {
      errors.push({ id, path, reason: 'The scenario must reference an existing registered case.' });
      continue;
    }
    if (!definition) continue;
    try {
      resolveStructureBindings(contract, definition);
    } catch (error) {
      errors.push({ id, path, reason: error.message });
      continue;
    }
    for (const gap of graph.gaps) {
      if (gap.id === id && ['MISSING_OR_WRONG_ROLE_BINDING', 'UNRESOLVED_CONDITION_BINDING',
        'INVALID_CASE_REGISTRATION'].includes(gap.kind)) {
        errors.push(gap);
      }
    }
  }
  return { status: errors.length ? 'FAIL' : 'PASS', scope, errors };
}

export function createImpactView({ root, affected = [], deps = [], checkDeps = false }) {
  const changedPaths = [...new Set(affected.map(relativeInput))].sort();
  const ids = [...new Set(deps)].sort();
  if (checkDeps && (!ids.length || changedPaths.length)) {
    throw new Error('--check-deps requires at least one --deps ID and does not accept --affected.');
  }
  const graph = buildImpactGraph(root, changedPaths);
  const { nodes, bindings, edges, upstream, downstream, gaps, localFile } = graph;
  const direct = new Set(ids.filter(id => nodes.has(id)));
  const directMatches = changedPaths.map(path => {
    const matches = [...(bindings.get(path) ?? [])].map(([id, reasons]) => ({ id, reasons: [...reasons].sort() }));
    matches.sort((a, b) => a.id.localeCompare(b.id));
    for (const { id } of matches) direct.add(id);
    if (!matches.length) gaps.push({ kind: 'UNMAPPED_PATH', path, reason: 'No matching relationship is known in these definitions.' });
    const present = localFile(path);
    if (!present) gaps.push({ kind: 'CHANGED_PATH_ABSENT', path, reason: 'This path may be deleted, renamed or unknown in the current tree.' });
    return { path, matches, disposition: !matches.length ? 'UNKNOWN' : present ? 'VERIFY_IF_NEEDED' : 'REVIEW_MAPPING' };
  });
  for (const id of ids) {
    if (!nodes.has(id)) gaps.push({ kind: 'UNKNOWN_ID', id, reason: 'Use a source-qualified ID from the impact view.' });
  }

  const references = collectReferences(direct, downstream);
  const prerequisiteIds = new Set();
  const referenceNodes = new Set([...direct, ...[...references].filter(id => !id.startsWith('file:'))]);
  for (const id of [...referenceNodes]) {
    for (const edge of upstream.get(id) ?? []) {
      if (edge.kind === 'scoped-receipt-reference') referenceNodes.add(edge.dependency);
    }
  }
  const relation = edge => ['required', 'required-evidence', 'required-foundation'].includes(edge.kind);
  const withPrerequisites = collectReachable(referenceNodes, id => {
    const required = (upstream.get(id) ?? []).filter(relation);
    for (const edge of required) prerequisiteIds.add(edge.dependency);
    return required.map(edge => edge.dependency);
  });
  const directDependencies = [...direct].flatMap(id => (upstream.get(id) ?? []).map(edge => edge.dependency));
  const linked = collectReachable(new Set([...references, ...withPrerequisites, ...directDependencies]), id =>
    (upstream.get(id) ?? []).filter(edge => ['model-input', 'model-reference', 'observation-mapping', 'replay-tool-input', 'runtime-input',
      'fixture-input', 'supporting-check'].includes(edge.kind))
      .map(edge => edge.dependency));
  const relationships = edges.filter(edge => linked.has(edge.consumer) && (linked.has(edge.dependency) || !nodes.has(edge.dependency)));
  const pathSet = new Set(changedPaths);
  const unresolved = gaps.filter(gap => linked.has(gap.id) || pathSet.has(gap.path) || ids.includes(gap.id) ||
    (gap.path === localSupportFile && gap.id === undefined));
  const unresolvedSet = new Set(unresolved);
  const otherDefinitionGaps = gaps.filter(gap => !unresolvedSet.has(gap));
  const nodeGaps = new Map();
  for (const gap of unresolved) {
    if (!gap.id) continue;
    const group = nodeGaps.get(gap.id) ?? [];
    group.push(gap.kind);
    nodeGaps.set(gap.id, group);
  }
  const impact = [...linked].sort().map(id => {
    const node = nodes.get(id);
    const reference = direct.has(id) || references.has(id);
    const issues = [...new Set(nodeGaps.get(id) ?? [])].sort();
    if (!node) return { id, type: 'missing-definition', execution: 'NOT_RUN', disposition: 'UNKNOWN' };
    return { ...node, maintenanceFile: resolve(root, node.file), execution: 'NOT_RUN',
      disposition: issues.some(issue => !unknownGapKinds.has(issue)) ? 'REVIEW_MAPPING' : issues.length ? 'UNKNOWN' :
        reference ? 'VERIFY_IF_NEEDED' : 'CHECK_FOR_REUSE',
      ...(issues.length ? { dispositionReasons: issues } : {}) };
  });
  return {
    schemaVersion: 1, status: 'NOT_RUN', completeKnownRelations: unresolved.length === 0,
    query: { affected: changedPaths, deps: ids },
    dependencyCheck: checkDeps ? checkStructureDependencies(graph, ids) : { status: 'NOT_RUN' },
    definitionIdentities: graph.definitionIdentities,
    directMatches,
    direct: [...direct].sort(),
    prerequisites: [...prerequisiteIds].sort(),
    references: [...references].filter(id => !direct.has(id)).sort(),
    nodes: impact,
    relationships,
    unresolved,
    otherDefinitionGaps,
    limits: [evidenceLimit, 'Production catalog prose matches are conservative file-level hints.',
      'Scoped module edges retain load and packaging consumers. Named case impact follows the recognized assertion branch.',
      'Runtime data dependencies and arbitrary computed imports are only known when declared or reported as gaps.'],
  };
}

export function diffImpactViews(previous, current) {
  if (previous?.schemaVersion !== 1 || JSON.stringify(previous.query) !== JSON.stringify(current.query) ||
      !Array.isArray(previous.nodes) || !Array.isArray(previous.relationships)) {
    throw new Error('Compare requires an earlier impact JSON with the same normalized query.');
  }
  const lookup = (items, key) => new Map(items.map(item => [key(item), item]));
  const id = item => item.id;
  const edgeKey = edge => JSON.stringify(Object.fromEntries(Object.entries(edge).sort(([left], [right]) => left.localeCompare(right))));
  const oldNodes = lookup(previous.nodes, id);
  const newNodes = lookup(current.nodes, id);
  const oldEdges = lookup(previous.relationships, edgeKey);
  const newEdges = lookup(current.relationships, edgeKey);
  const changedDefinitions = [...newNodes.keys()].filter(key => oldNodes.has(key) &&
    newNodes.get(key).definitionSha256 !== oldNodes.get(key).definitionSha256);
  const changedRelations = new Map();
  for (const edge of [...oldEdges.values(), ...newEdges.values()]) {
    const consumers = changedRelations.get(edge.dependency) ?? [];
    consumers.push(edge);
    changedRelations.set(edge.dependency, consumers);
  }
  return {
    addedNodes: [...newNodes.keys()].filter(key => !oldNodes.has(key)),
    removedNodes: [...oldNodes.keys()].filter(key => !newNodes.has(key)),
    changedDefinitions,
    referencesToChangedDefinitions: [...collectReferences(new Set(changedDefinitions), changedRelations)]
      .filter(key => !changedDefinitions.includes(key)).sort(),
    addedRelationships: [...newEdges].filter(([key]) => !oldEdges.has(key)).map(([, edge]) => edge),
    removedRelationships: [...oldEdges].filter(([key]) => !newEdges.has(key)).map(([, edge]) => edge),
  };
}
