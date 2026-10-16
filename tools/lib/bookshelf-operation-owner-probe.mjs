import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import {BookshelfReadOwner} from '../../entry/src/main/ets/features/bookshelf/BookshelfReadOwner.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {classifyReaderSource} from '../../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
import * as sourceNames from '../../entry/src/main/ets/features/bookshelf/BookshelfSourceNameProjection.ts';
import {readFileSync} from 'node:fs';
import {BookRequestNotDispatchedError} from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
const { ts } = installedEtsCompiler();
export const bookshelfOperationSource=path=>readFileSync(new URL('../../entry/src/main/ets/'+path,import.meta.url),'utf8');
export function bookshelfOperationClass(path,result,deps={}) {
 const text=bookshelfOperationSource(path).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export (?:type )?\{[\s\S]*?\} from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'');
 const declarations=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).statements;
 const ownNames=new Set(declarations.flatMap(statement=>ts.isVariableStatement(statement)?
   statement.declarationList.declarations.map(node=>node.name.text):statement.name?.text?[statement.name.text]:[]));
 // A complete production declaration supplies its own top-level binding;
 // callers may carry the same real type in their wider dependency bundle.
 deps=Object.fromEntries(Object.entries(deps).filter(([name])=>!ownNames.has(name)));
 const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function(...Object.keys(deps),code+`;return ${result};`)(...Object.values(deps));
}
export function actualBookshelfOperationTypes(deps) {
 deps=actualBookshelfRemovalTypes(deps);
 const presentation=bookshelfOperationClass('features/bookshelf/LocalImportPresentationOwner.ts','({LocalImportPresentation,LocalImportPresentationOwner,LOCAL_IMPORT_PRESENTATION_KEY})');
 const operation=bookshelfOperationClass('features/bookshelf/BookshelfOperationOwner.ts','({BookshelfOperationOwner,EMPTY_BOOKSHELF_OPERATION_SNAPSHOT})',{...deps,...presentation});
 const readable=bookshelfOperationClass('features/bookshelf/BookshelfReadableAdmissionOwner.ts','({BookshelfReadableAdmissionOwner,EMPTY_READABLE_ADMISSION})',deps);
 const BookshelfProjectionOwner=bookshelfOperationClass('features/bookshelf/BookshelfProjectionOwner.ts','BookshelfProjectionOwner',{BookshelfReadOwner,projectOperationFacts,...sourceNames});
 const SourceGateway=bookshelfOperationClass('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:deps.ReaderRuntimeOwner,classifyReaderSource});
 const Host=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost',{...deps,...operation,...readable,BookshelfProjectionOwner,SourceGateway});
 return {...presentation,...operation,...readable,Host};
}
/** Actual finite authority classes. Tests exercising native IO must supply
 * their real AtomicFile/SHA/Runtime seams; missing platform IO fails explicitly
 * rather than synthesizing a successful empty journal or a write receipt. */
export function actualBookshelfRemovalTypes(deps) {
 deps={ReaderWriteEvidence,BookRequestNotDispatchedError,isReaderCoreTransactionPendingError,...deps};
 const unavailable=()=>{throw Error('actual bookshelf intent platform IO seam is required');};
 const store=bookshelfOperationClass('features/bookshelf/BookshelfManagementIntentStore.ts',
   '({BookshelfManagementIntentStore,isBookshelfRemovalMethod})',{
     fileIo:{readText:unavailable},util:{generateRandomUUID:unavailable},replaceReaderAtomicSnapshot:unavailable,sha256Hex:unavailable,...deps});
 deps={...store,...deps};
 deps.ReaderCoreGateway??=bookshelfOperationClass('app/ReaderCoreGateway.ts','ReaderCoreGateway',deps);
 deps.BookshelfManagementGateway??=bookshelfOperationClass('features/bookshelf/BookshelfManagementGateway.ts','BookshelfManagementGateway',deps);
 deps.BookshelfRemovalGateway??=bookshelfOperationClass('features/bookshelf/BookshelfRemovalGateway.ts','BookshelfRemovalGateway',deps);
 return deps;
}
export function actualBookshelfHostField(index,Host,AppStorage) {
 const text=bookshelfOperationSource('pages/Index.ets'),start=text.indexOf('  private bookshelfHost:'),end=text.indexOf('\n  );',start)+6;
 const expression=text.slice(text.indexOf('=',start)+1,end).trim().replace(/;$/,'');
 const code=ts.transpileModule('const value='+expression+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function('BookshelfHost','AppStorage','IMPORT_PRESENTATION_KEY',code+'return value;').call(index,Host,AppStorage,'reader.bookshelf.import.presentation.v1');
}
