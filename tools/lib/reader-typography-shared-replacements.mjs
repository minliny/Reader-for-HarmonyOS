import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditTypographyConsumers} from './reader-typography-consumer-audit.mjs';
/** Keep the immutable pre-migration tuple audit when real consumers move to
 * one shared component. Every admitted replacement must be reached by the
 * original actual page; test-bookshelf-view-mode-receipts executes that edge. */
export function sharedTypographyReplacement(file,expected,pageSource){
 const admitted=(file.endsWith('/BookshelfPage.ets')&&expected.method==='bookshelfList'&&expected.text==='this.viewModeError')||
  (file.endsWith('/BookshelfSettingsPage.ets')&&expected.method==='build'&&expected.text==='this.error');
 if(!admitted)return undefined;
 assert.match(pageSource,/ReaderRecoveryNotice\(\{ view: this\.viewModeRecovery\(\)/,'actual page consumes shared replacement');
 const target='entry/src/main/ets/features/common/ReaderRecoveryNotice.ets';
 const source=readFileSync(new URL('../../'+target,import.meta.url),'utf8');
 const actual=auditTypographyConsumers(source,target).find(node=>node.kind==='Text'&&node.text==='this.view.message');
 assert.ok(actual,'shared actual message carrier');
 assert.equal(actual.modifiers.fontSize.expression,expected.changes.fontSize,'preserve exact original 12fp/AUTO tuple');
 return actual;
}
