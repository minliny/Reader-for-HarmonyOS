import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { auditTypographyConsumers, typographyExpressionContext, isSharedTypographyExpression, typographyRoleImports } from './lib/reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const root = new URL('../entry/src/main/ets/features/reading/', import.meta.url), contracts = new Map();
const retain = (file,method,property,expression,maximum,reason) => contracts.set(JSON.stringify([file,method,property,expression]), { maximum, count:0,reason });
for (const [file,method] of [['ReaderAppearanceFullPanel.ets','fullFontCell'],['ReaderAppearanceModulePanel.ets','compactFontCell'],['ReaderAppearanceSharedActors.ets','sharedFontCell']])
  retain(file,method,'fontFamily','readerRegisteredFontFamily(this.getUIContext().getFont(), readerAppearanceFontSlotFamily(this.snapshot, fontId))',1,
    'the preview displays the actual selected/registered user face; its UI size and weight remain public roles');
retain('ReaderControlAppearanceContent.ets','fontCell','fontFamily','this.visiblePreviewFamily(font)',1,
  'the retained preview forwards the actual selected/registered user face, not a fixed chrome family');
retain('ReaderControlSettingsContent.ets','segmentRow','lineHeight','this.label(row).height',1,
  'the mounted label line box follows its existing spatial actor; public 10→11fp endpoints follow the same p');
for (const [property,expression] of Object.entries({fontFamily:'style.fontFamily',fontWeight:'style.fontWeight',fontSize:'style.fontSize',lineHeight:'style.lineHeight',letterSpacing:'style.letterSpacing'}))
  retain('ReaderNativeTextMeasurement.ets','measure',property,expression,1,
    'the native measurement node transfers unchanged to the renderer and must share the actual body recipe');
for (const [property,expression] of Object.entries({fontFamily:'readerRegisteredFontFamily(this.getUIContext().getFont(), readerAppearanceSnapshotFontFamily(this.appearance))',
  fontWeight:'FontWeight.Regular',fontSize:'this.appearance.fontSize',lineHeight:'readerAppearanceLineHeight(this.appearance)',letterSpacing:'this.appearance.letterSpacing'}))
  retain('ReadingSurface.ets','build',property,expression,1,'the runtime body tuple belongs to the persisted reader appearance owner and pagination contract');
retain('ReadingSurface.ets','build','lineHeight','this.layout.titleLineHeightFp',1,'the title line box belongs to the actual pagination/layout snapshot');
// The top chrome is already one shared public ReaderTextStyle with platform
// calibration and an explicit public fallback. Scope recognition to this owner
// and exact modifier chain, rather than exempting any arbitrary helper name.
const calibratedSource = readFileSync(new URL('ReaderPageChrome.ets',root),'utf8');
assert.match(calibratedSource,/private topTextStyle\(\): ReaderTextStyle[\s\S]*const style = readerPageChromeTopTextStyle\(this.layout, context\)/);
const calibration = readFileSync(new URL('ReaderPageChromeTextMeasurement.ets',root),'utf8');
assert.match(calibration,/return TYPE_READER_IMMERSIVE_TIME/);
assert.match(calibration,/new ReaderTextStyle\(READER_FONT_HARMONYOS_SANS, 400, fp, undefined,[\s\S]*'platformCalibration'/);
const isCalibrated = (file,node,property,expression) => file === 'ReaderPageChrome.ets' && node.method === 'build' &&
  expression === `this.topTextStyle().${({fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'})[property]??property}`;
let files=0,carriers=0,shared=0,calibrated=0,runtime=0;
for (const file of readdirSync(root).filter(file=>file.endsWith('.ets'))) {
  files++; const source=readFileSync(new URL(file,root),'utf8'),imports=typographyRoleImports(source,file),expressionContext=typographyExpressionContext(source,'entry/src/main/ets/features/reading/'+file);
  for (const node of auditTypographyConsumers(source,file)) {
    carriers++;
    for (const [property,modifier] of Object.entries(node.modifiers)) {
      if (isSharedTypographyExpression(modifier.expression,expressionContext,node.owner)) {
        for (const role of modifier.expression.matchAll(/TYPE_\w+/g)) {
          assert.ok(imports.has(role[0]),`${file}:${node.line}: actual public role import ${role[0]}`);
          assert.ok(readerTypographyRoles[role[0]],`${file}:${node.line}: actual public role implementation ${role[0]}`);
        }
        shared++;continue;
      }
      if(isCalibrated(file,node,property,modifier.expression)){calibrated++;continue;}
      const receipt=contracts.get(JSON.stringify([file,node.method,property,modifier.expression]));
      assert.ok(receipt,`${file}:${node.line}/${property}: private typography must consume the public role (${modifier.expression})`);
      assert.ok(++receipt.count<=receipt.maximum,`${file}/${node.method}: no copied runtime exception`);runtime++;
    }
  }
}
assert.equal(runtime,16,'exact bounded runtime contracts, no generic reader exclusion');
assert.equal(calibrated,10,'both calibrated top labels share one actual implementation');
console.log(`PASS reading Typography actual AST: ${files} files, ${carriers} carriers, ${shared+calibrated} public/calibrated arguments; ${runtime} documented runtime arguments; zero private chrome debt`);
