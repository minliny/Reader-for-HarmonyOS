import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {BookRequestNotDispatchedError} from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
// Execute the entire original pure owner. Only its ArkTS-relative dependency
// binding is supplied; no drain, receipt or recovery algorithm is copied.
const source=readFileSync(new URL('../../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts',import.meta.url),'utf8');
const exports=new Function('BookRequestNotDispatchedError',stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'')).replace(/\bexport /g,'')+
 ';return {ReadingSessionProgressOwner,readingSessionProgressOwner};')(BookRequestNotDispatchedError);
export const {ReadingSessionProgressOwner,readingSessionProgressOwner}=exports;
