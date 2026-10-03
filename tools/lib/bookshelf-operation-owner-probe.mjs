import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
export const bookshelfOperationSource=path=>readFileSync(new URL('../../entry/src/main/ets/'+path,import.meta.url),'utf8');
export function bookshelfOperationClass(path,result,deps={}) {
 const text=bookshelfOperationSource(path).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export \{[\s\S]*?\} from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'');
 const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function(...Object.keys(deps),code+`;return ${result};`)(...Object.values(deps));
}
export function actualBookshelfOperationTypes(deps) {
 const presentation=bookshelfOperationClass('features/bookshelf/LocalImportPresentationOwner.ts','({LocalImportPresentation,LocalImportPresentationOwner,LOCAL_IMPORT_PRESENTATION_KEY})');
 const operation=bookshelfOperationClass('features/bookshelf/BookshelfOperationOwner.ts','({BookshelfOperationOwner,EMPTY_BOOKSHELF_OPERATION_SNAPSHOT})',{...deps,...presentation});
 const Host=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost',{...deps,...operation});
 return {...presentation,...operation,Host};
}
export function actualBookshelfHostField(index,Host,AppStorage) {
 const text=bookshelfOperationSource('pages/Index.ets'),start=text.indexOf('  private bookshelfHost:'),end=text.indexOf('\n  );',start)+6;
 const expression=text.slice(text.indexOf('=',start)+1,end).trim().replace(/;$/,'');
 const code=ts.transpileModule('const value='+expression+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function('BookshelfHost','AppStorage','IMPORT_PRESENTATION_KEY',code+'return value;').call(index,Host,AppStorage,'reader.bookshelf.import.presentation.v1');
}
