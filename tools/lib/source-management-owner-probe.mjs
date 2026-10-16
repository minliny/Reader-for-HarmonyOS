import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { virtualFilePath } from './tool-environment.mjs';
import {bookshelfOperationClass,bookshelfOperationSource} from './bookshelf-operation-owner-probe.mjs';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
export function actualSourceManagementTypes(deps) {
 const facts={projectOperationFacts,projectCommitReadback};
 const projectPersistedReceipt=bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
 const http=bookshelfOperationClass('app/HttpTransportPolicy.ts','({httpUrlHostname,isPrivateNetworkTarget})');
 const categories=bookshelfOperationClass('features/source/ReaderSourceCategory.ts','({classifyReaderSource})');
 const all={...deps,...facts,ReaderWriteEvidence,errorMessageOf,projectPersistedReceipt,isReaderCoreTransactionPendingError,...http,...categories};
 const SourceGateway=bookshelfOperationClass('features/source/SourceGateway.ts','SourceGateway',all);
 const SourceOrchestrator=bookshelfOperationClass('features/source/SourceOrchestrator.ets','SourceOrchestrator',{...all,SourceGateway});
 const SourceHost=bookshelfOperationClass('features/source/SourceHost.ets','SourceHost',{...all,SourceGateway,SourceOrchestrator});
 return{SourceGateway,SourceOrchestrator,SourceHost};
}

export function actualSourceManagementHostField(index,SourceHost) {
 const { ts } = installedEtsCompiler();
 const text=bookshelfOperationSource('pages/Index.ets');
 const ast=ts.createSourceFile(virtualFilePath('ActualSourceManagementField.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS);
 const owner=ast.statements.find(n=>n.members?.some(m=>m.name?.getText(ast)==='sourceHost'));
 const field=owner?.members.find(m=>m.name?.getText(ast)==='sourceHost');
 if (!field?.initializer) throw Error('actual SourceHost Index field initializer missing');
 const code=ts.transpileModule('const value='+field.initializer.getText(ast)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function('SourceHost',code+'return value;').call(index,SourceHost);
}
