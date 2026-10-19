import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "native-motion": {
    "description": "Compile and run existing motion C++ case, without render_state",
    "resources": [
      "native-build"
    ]
  },
  "native-render-state": {
    "description": "Compile and run existing render_state C++ case, without motion",
    "resources": [
      "native-build"
    ]
  }
};

async function case_native_motion() {
const {runBookTurnNativeCase}=await import('./lib/book-turn-native-case.mjs');runBookTurnNativeCase('motion');
}

async function case_native_render_state() {
const {runBookTurnNativeCase}=await import('./lib/book-turn-native-case.mjs');runBookTurnNativeCase('render_state');
}

const implementations = {'native-motion':case_native_motion,'native-render-state':case_native_render_state};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
