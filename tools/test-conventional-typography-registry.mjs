import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"public-role-values": {"description": "当前公共字体role数值准入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');

const check=(name,role)=>{assert.ok(role&&typeof role.fontFamily==='string'&&role.fontFamily.length>0,name+': physical family binding');assert.ok(Number.isFinite(role.fontSizeFp)&&role.fontSizeFp>0,name+': positive finite font size');assert.ok(role.lineHeightFp===undefined||Number.isFinite(role.lineHeightFp)&&role.lineHeightFp>0,name+': optional finite line box');};
const selected=Object.entries(readerTypographyRoles).filter(([name])=>name.startsWith('TYPE_'));assert.ok(selected.length>0);
for(const [name,role] of selected)check(name,role);
assert.throws(()=>check('invalid',{fontFamily:'face',fontSizeFp:NaN}),'malformed actual registry tuple cannot be accepted');

}
