import assert from 'node:assert/strict';
import { typographyRoleImports } from './lib/reader-typography-consumer-audit.mjs';
const imports = typographyRoleImports(`
// import { TYPE_FAKE } from '../common/ReaderTypography';
import { TYPE_FORM_NOTE } from '../common/ReaderTypography';
import { TYPE_APP_BODY, TYPE_FORM_STATUS } from '../common/ReaderTypography';
import { TYPE_UNRELATED } from './BusinessTypography';
@Component struct Probe { build() { Column() {} } }
`);
assert.deepEqual([...imports].sort(), ['TYPE_APP_BODY','TYPE_FORM_NOTE','TYPE_FORM_STATUS']);
assert.ok(!imports.has('TYPE_FAKE') && !imports.has('TYPE_UNRELATED'), 'comment and unrelated module cannot masquerade as central roles');
console.log('PASS typography imports: real merged/split named imports, business additions admitted, spoofed comment/module rejected');

// Ordinary contract CI verifies actual imported roles after other owner imports
// are inserted. The strict historical snapshot mode alone owns prefix/byte proof.
const { restoreTypographyMigration } = await import('./lib/reader-typography-migration-fixture.mjs');
const roleImport = "import { TYPE_PAGE_TITLE } from '../common/ReaderTypography';\n";
const otherImport = "import { readerAppColor } from '../common/ReaderThemeRegistry';\n";
const panel = "@Component struct ImportOrderProbe { @Builder private title() { Text('title').fontSize(TYPE_PAGE_TITLE.fontSizeFp); } build() { Column() {} } }\n";
const fixture = { path:'ImportOrderProbe.ets',roleImport,sha256:'not-used-by-normal-ci',nodes:[{ method:'title',kind:'Text',text:"'title'",original:{fontSize:'24'},changes:{fontSize:'TYPE_PAGE_TITLE.fontSizeFp'} }],extras:[] };
assert.equal(restoreTypographyMigration(otherImport+roleImport+panel,fixture,{verifySource:false}),otherImport+roleImport+panel);
assert.throws(()=>restoreTypographyMigration(otherImport+roleImport+panel,fixture,{verifySource:true}),/exact migration import/);
assert.throws(()=>restoreTypographyMigration(otherImport+panel,fixture,{verifySource:false}),/actual public import/);
assert.throws(()=>restoreTypographyMigration(otherImport+roleImport+panel.replace('TYPE_PAGE_TITLE.fontSizeFp','25'),fixture,{verifySource:false}),/exact migration consumer/);
console.log('PASS normal migration imports may reorder; missing actual role/changed tuple rejects; historical byte proof stays strict');
