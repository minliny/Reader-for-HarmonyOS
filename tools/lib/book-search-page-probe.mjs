import {readFileSync} from 'node:fs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import * as authors from '../../entry/src/main/ets/app/library/BookAuthorMetadata.ts';
import * as timing from '../../entry/src/main/ets/app/library/BookSearchTiming.ts';
import * as pages from '../../entry/src/main/ets/app/library/BookSearchPageProgress.ts';
import * as categories from '../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
import * as errors from '../../entry/src/main/ets/app/ErrorMessage.ts';
import * as facts from '../../entry/src/main/ets/app/library/BookAcquisitionPresentation.ts';
import * as provider from '../../entry/src/main/ets/features/source/application/SourceSwitchProviderFamily.ts';
import {runBookSourceWorkers} from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
const read=path=>readFileSync(new URL('../../entry/src/main/ets/'+path,import.meta.url),'utf8');
const projection=pureModuleProbe(read('features/search/application/SearchBookProjection.ts'),'SearchBookProjection.ts',authors,['SearchBookProjection']);
export const gatewayTypes=pureModuleProbe(read('features/search/application/SearchGateway.ts'),'SearchGateway.ts',{
 ...authors,...timing,...pages,...categories,...errors,...projection,ReaderRuntimeOwner:{current(){throw Error('explicit Runtime required');}}
},['SearchGateway','decodeBookSearchResult','searchBookWithAdmission','searchSourceHealthState']);
export const searchTypes=pureModuleProbe(read('features/search/application/SearchOrchestrator.ets'),'SearchOrchestrator.ets',{
 ...gatewayTypes,...pages,...categories,...errors,runBookSourceWorkers,projectOperationFacts,hilog:{info(){},warn(){},error(){}}
},['SearchOrchestrator','SearchQueryRun']);
export const switchTypes=pureModuleProbe(read('features/source/application/SourceSwitchGateway.ts'),'SourceSwitchGateway.ts',{
 ...authors,...timing,...pages,...categories,...errors,...facts,...provider,...gatewayTypes,runBookSourceWorkers,
 ReaderRuntimeOwner:{current(){throw Error('explicit Runtime required');}}
},['SourceSwitchGateway']);
