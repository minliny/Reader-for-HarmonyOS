import { readFileSync, writeFileSync } from 'node:fs';
import { loadStructureDefinition, resolveStructureBindings } from './lib/structure-contract.mjs';

const id = 'reading.control-seven-module-navigation';
const modules = [
  ['search', 'reading.control-search-morph-back'],
  ['directory', 'reading.control-directory-navigation'],
  ['appearance', 'reading.control-appearance-navigation'],
  ['settings', 'reading.control-settings-navigation'],
  ['tts', 'reading.control-tts-navigation'],
  ['replace', 'reading.control-replace-morph'],
  ['autopage', 'reading.control-autopage-navigation'],
];
const home = 'open-state';
const returned = 'return-home-state';
const filename = caseId => new URL('cases/' + caseId + '.json', import.meta.url);
const load = caseId => {
  const contract = JSON.parse(readFileSync(filename(caseId), 'utf8'));
  if (contract.id !== caseId || contract.phase !== 1 || contract.pageId !== 'reading') {
    throw new Error('Unexpected reading module reference ' + caseId);
  }
  return contract;
};
const moduleCases = modules.map(([module, caseId]) => [module, load(caseId)]);
const opening = moduleCases[0][1];
const entrySteps = opening.steps.slice(0, opening.steps.findIndex(step => step.id === home) + 1);
if (!entrySteps.length || entrySteps.at(-1).id !== home) throw new Error('Reading opening state is missing');

const steps = [...entrySteps];
const assertions = opening.assertions.filter(assertion => assertion.sample === home).map(assertion =>
  ({ ...assertion, id:id + '.open' }));
let lastHome = home;
for (const [module, contract] of moduleCases) {
  const start = contract.steps.findIndex(step => step.id === home);
  const end = contract.steps.findIndex(step => step.id === returned);
  if (start < 0 || end <= start) throw new Error('Missing navigation boundaries for ' + contract.id);
  const scoped = contract.steps.slice(start + 1, end + 1);
  const mapped = new Map(scoped.map(step => [step.id, module + '-' + step.id]));
  mapped.set(home, lastHome);
  const rename = (key, value) => {
    if (value === undefined) return {};
    if (!mapped.has(value)) throw new Error('Unbound ' + key + ' reference in ' + contract.id + ': ' + value);
    return { [key]:mapped.get(value) };
  };
  for (const step of scoped) {
    steps.push({ ...step, id:mapped.get(step.id), ...rename('from', step.from),
      ...rename('afterAction', step.afterAction) });
  }
  for (const assertion of contract.assertions.filter(assertion => scoped.some(step => step.id === assertion.action))) {
    assertions.push({ ...assertion, id:id + '.' + module + '.' + assertion.id.slice(contract.id.length + 1),
      ...rename('action', assertion.action), ...rename('baseline', assertion.baseline), ...rename('sample', assertion.sample) });
  }
  lastHome = mapped.get(returned);
}

const dismiss = opening.steps.find(step => step.id === 'dismiss');
const dismissed = opening.steps.find(step => step.id === 'dismiss-state');
const dismissAssertion = opening.assertions.find(assertion => assertion.action === 'dismiss');
if (!dismiss || !dismissed || !dismissAssertion) throw new Error('Reading dismissal is missing');
steps.push({ ...dismiss, from:lastHome }, dismissed);
assertions.push({ ...dismissAssertion, id:id + '.dismiss', baseline:lastHome });

const contract = {
  id, version:2, phase:1, pageId:'reading',
  fixture:{ ...opening.fixture,
    description:'One normal public-book reading session, seven mounted control modules with their Quick and Full endpoints, and a final Back.' },
  steps,
  ownerSources:[...new Set(moduleCases.flatMap(([, item]) => item.ownerSources))],
  assertions,
  structure:Object.fromEntries(steps.filter(step => step.kind === 'sample').map(step => [step.id,step.id])),
};
resolveStructureBindings(contract, loadStructureDefinition());
const bytes = JSON.stringify(contract, null, 2) + '\n';
const [mode, ...extra] = process.argv.slice(2);
if (extra.length || !['--write','--check'].includes(mode)) {
  throw new Error('Choose --write or --check for the seven-module case snapshot');
}
if (mode === '--write') writeFileSync(filename(id), bytes);
else if (readFileSync(filename(id), 'utf8') !== bytes) throw new Error('Seven-module reading case snapshot differs from its inputs');
process.stdout.write(JSON.stringify({ caseId:id, steps:steps.length, assertions:assertions.length }) + '\n');
