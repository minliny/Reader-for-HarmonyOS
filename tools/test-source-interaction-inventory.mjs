import { selectContractCases } from './lib/contract-case-selection.mjs';
import { runSourceInteractionCases, sourceInteractionCaseDefinitions } from './page-structure/source-interaction-inventory-cases.mjs';

await runSourceInteractionCases(selectContractCases(sourceInteractionCaseDefinitions));
