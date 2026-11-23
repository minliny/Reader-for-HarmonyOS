import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { actualReaderPageLayout } from './lib/reader-page-shell-runtime-probe.mjs';
const selected = selectContractCases({ 'surface-measurements': {
  description: 'Actual download sheet and confirmation Area receivers accept current numeric/vp heights and reject retired opening, metrics and presentation callbacks', resources: [] } });
for (const id of selected) {
  const source = readFileSync(new URL('../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets', import.meta.url), 'utf8');
  const sdk = boundedSurfaceSdk();
  const owner = sdk.consumer(source, ['sheetAreaHandler','confirmationAreaHandler','recordSheetTitleHeight','recordSheetFooterHeight'],
    actualReaderPageLayout());
  let layout = 1;
  Object.assign(owner, { mounted: true, presentationGeneration: 2, sheetOpeningGeneration: 3, confirmationGeneration: 4,
    sheet: 'settings', confirmation: 'cleanup', sheetTitleMeasuredHeight: 48, sheetFooterMeasuredHeight: 76,
    dialogActionsMeasuredHeight: 44, measurementGeneration: () => layout,
    presentationIsCurrent: generation => owner.mounted && generation === owner.presentationGeneration });
  const title = owner.sheetAreaHandler('title', 3), footer = owner.sheetAreaHandler('footer', 3);
  const actions = owner.confirmationAreaHandler(4, 2);
  title({}, { height: '91vp' }); footer({}, { height: 112 }); actions({}, { height: '95vp' });
  assert.deepEqual([owner.sheetTitleMeasuredHeight,owner.sheetFooterMeasuredHeight,owner.dialogActionsMeasuredHeight], [91,112,95]);
  for (const retire of [() => owner.sheetOpeningGeneration++, () => layout++, () => owner.presentationGeneration++, () => { owner.mounted = false; }]) {
    retire(); title({}, { height: 900 }); footer({}, { height: 900 });
    assert.deepEqual([owner.sheetTitleMeasuredHeight,owner.sheetFooterMeasuredHeight], [91,112]);
  }
  owner.mounted = true; owner.presentationGeneration = 2; owner.sheetOpeningGeneration = 3; layout = 1;
  owner.confirmationGeneration = 5; actions({}, { height: 900 }); assert.equal(owner.dialogActionsMeasuredHeight, 95);
  owner.confirmationGeneration = 4; owner.confirmation = ''; actions({}, { height: 900 }); assert.equal(owner.dialogActionsMeasuredHeight, 95);
  for (const sheet of ['book-actions', 'chapter-actions']) {
    owner.mounted = true; owner.presentationGeneration = 2; owner.sheetOpeningGeneration = 3; layout = 1; owner.sheet = sheet;
    owner.operationsHeaderMeasuredHeight = 48; owner.bookOperationsBodyMeasuredHeight = 120;
    const header = owner.sheetAreaHandler('operations-header', 3), body = owner.sheetAreaHandler('operations-body', 3);
    header({}, { height: '76vp' }); body({}, { height: '188vp' });
    assert.equal(owner.operationsHeaderMeasuredHeight, 76);
    assert.equal(owner.bookOperationsBodyMeasuredHeight, sheet === 'book-actions' ? 188 : 120,
      'only the book action sheet records an intrinsic body height');
    for (const retire of [() => owner.sheetOpeningGeneration++, () => layout++, () => owner.presentationGeneration++,
      () => { owner.sheet = sheet === 'book-actions' ? 'chapter-actions' : 'book-actions'; }, () => { owner.mounted = false; }]) {
      owner.mounted = true; owner.presentationGeneration = 2; owner.sheetOpeningGeneration = 3; layout = 1; owner.sheet = sheet;
      retire(); header({}, { height: 900 }); body({}, { height: 900 });
      assert.equal(owner.operationsHeaderMeasuredHeight, 76);
      assert.equal(owner.bookOperationsBodyMeasuredHeight, sheet === 'book-actions' ? 188 : 120,
        'retired operation sheet Area actors cannot overwrite the successor budget');
    }
  }
  assert.equal((source.match(/\.onAreaChange\(this\.sheetAreaHandler\(/g) ?? []).length, 5);
  assert.equal((source.match(/\.onAreaChange\(this\.confirmationAreaHandler\(/g) ?? []).length, 1);
  const unqualified = (_old, area) => { owner.dialogActionsMeasuredHeight = Number(area.height); };
  unqualified({}, { height: 900 }); assert.equal(owner.dialogActionsMeasuredHeight, 900, 'old direct Area assignment can overwrite the successor budget');
  console.log('PASS download surface current Area receipts and retired callback negative; no native layout execution');
  recordContractCasePass(id);
}
