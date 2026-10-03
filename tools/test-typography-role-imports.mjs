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
