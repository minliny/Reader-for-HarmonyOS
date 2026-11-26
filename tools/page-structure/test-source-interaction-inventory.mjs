import { selectContractCases } from '../lib/contract-case-selection.mjs';
import { runSourceInteractionCases, sourceInteractionCaseDefinitions } from './source-interaction-inventory-cases.mjs';

const outputArgs = process.argv.slice(2).filter(arg => arg.startsWith('--evidence-path='));
if (outputArgs.length > 1) throw Error('Only one explicit evidence path is allowed');
const evidencePath = outputArgs[0]?.slice('--evidence-path='.length);
if (evidencePath && !evidencePath.startsWith('.reader-artifacts/')) throw Error('Evidence must be written to an explicit repository artifact path');
const selected = selectContractCases(sourceInteractionCaseDefinitions, { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });
await runSourceInteractionCases(selected, evidencePath);
