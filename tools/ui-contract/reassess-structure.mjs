#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { toolIdentity } from './lib/cases.mjs';
import { jsonBytes, sha256 } from './lib/evidence.mjs';
import { reassessOriginalStructure } from './lib/receipt.mjs';

try {
  const {values, tokens} = parseArgs({
    options: {
      input: {type:'string'},
      'expected-root': {type:'string'},
      bindings: {type:'string'},
      output: {type:'string'},
    },
    tokens:true,
  });
  if (tokens.length < 3 || new Set(tokens.map(token => token.name)).size !== tokens.length ||
      !values.input || !/^[a-f0-9]{64}$/u.test(values['expected-root'] ?? '') || !values.bindings) {
    throw new Error('Specify one original receipt, its independent root, and explicit historical bindings');
  }
  const historicalDefinition = JSON.parse(readFileSync(values.bindings, 'utf8'));
  const assessment = reassessOriginalStructure({
    receiptPath:resolve(values.input), expectedRoot:values['expected-root'], historicalDefinition,
  });
  const report = {
    schema:'reader-ui-structure-reassessment-v1',
    tool:toolIdentity(),
    historicalDefinition,
    ...assessment,
  };
  const bytes = jsonBytes(report);
  if (values.output) writeFileSync(values.output, bytes, {flag:'wx', mode:0o600});
  console.log(JSON.stringify({
    originalRoot: assessment.source.rootSha256,
    reportSha256:sha256(bytes),
    observations:assessment.observations,
    behavior:assessment.behavior,
    execution:assessment.execution,
    output:values.output ?? null,
  }));
  if (assessment.execution !== 'PASS') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({execution:'ERROR',reason:error.message}));
  process.exitCode = 2;
}
