// Selection only. Importing this module never runs a contract or a subprocess.
export function selectContractCases(definitions, { argv = process.argv.slice(2) } = {}) {
  if (!definitions || Array.isArray(definitions) || typeof definitions !== 'object') throw new TypeError('Contract case definitions must be an object');
  const ids = Object.keys(definitions);
  if (!ids.length || ids.some(id => !id || id.includes(',') || id.includes('#'))) throw new Error('Contract case IDs must be nonempty and cannot contain comma or #');
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--list')) {
    console.log(JSON.stringify({ kind: 'reader-contract-case-list', status: 'NOT_RUN', cases: definitions }));
    return [];
  }
  if (argv.length !== 2 || argv[0] !== '--case') throw new Error('Use --list or --case <comma-separated case IDs>; no implicit all selection');
  const selected = argv[1].split(',');
  if (selected.some(id => !id || id.trim() !== id)) throw new Error('Empty or whitespace contract case selection');
  if (new Set(selected).size !== selected.length) throw new Error('Duplicate contract case selection');
  for (const id of selected) if (!Object.hasOwn(definitions, id)) throw new Error(`Unknown contract case: ${id}`);
  return selected;
}

export function recordContractCasePass(id) {
  if (typeof id !== 'string' || !id) throw new TypeError('A passed contract needs a case ID');
  console.log(JSON.stringify({ kind: 'reader-contract-case-result', case: id, status: 'PASS' }));
}
