import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });

const root = new URL('../../../', import.meta.url);
const gatewayFile = new URL('entry/src/main/ets/features/reading/ReadingOfflineGateway.ts', root);
const indexFile = new URL('entry/src/main/ets/pages/Index.ets', root);
const { ReadingOfflineGateway } = await import(gatewayFile.href);
const { ReadingOfflineMaterializationError } = await import(new URL('entry/src/main/ets/features/reading/ReadingOfflineContract.ts', root));
const { productionMotionMethods } = await import(new URL('tools/lib/reader-motion-method-probe.mjs', root));
const sourceId = 'https://m.popofree.com#🎃';
const bookId = '/novel/100749/';

function session(count) {
  return { acquisitionMode: 'online', identity: { sourceId, bookId }, detailUrl: bookId,
    tocUrl: '/toc', book: { title: '终宋', author: 'fixture' }, continuationVariables: [], hostRequirements: [],
    entries: Array.from({ length: count }, (_, index) => ({ index, title: `第${index + 1}章`,
      url: `https://fixture.invalid/chapter/${index}`, variables: [] })) };
}

function runtimeFor(book, failure) {
  const calls = [], manifests = new Set();
  const states = book.entries.map(() => 'missing');
  const cachedBytes = book.entries.map(() => 0);
  const lastErrors = book.entries.map(() => undefined);
  return { calls, states, cachedBytes, lastErrors,
    async request(method, params = {}) {
      calls.push({ method, params: structuredClone(params) });
      if (method === 'cache.book.prefetch') {
        const indexes = Array.from({length: params.chapterRange[1] - params.chapterRange[0]}, (_, p) => params.chapterRange[0]+p);
        for (const index of indexes) {
          states[index] = failure === 'body' ? 'failed' : 'inProgress';
          cachedBytes[index] = failure === 'body' ? 0 : 90;
          lastErrors[index] = failure === 'body' ? 'fixture transport HTTP 403' : undefined;
        }
        return { data: { sourceId, bookId, chapterRange: params.chapterRange,
          chapterCount: book.entries.length, prefetchedCount: failure === 'body' ? 0 : indexes.length,
          queuedIndexes: indexes, alreadyQueuedIndexes: [], skippedCachedIndexes: [],
          materializations: failure === 'body' ? [] : indexes.map(chapterIndex => ({chapterIndex, token: `lease-${chapterIndex}`})) } };
      }
      if (method === 'cache.book.status') return { data: { sourceId, bookId,
        chapters: book.entries.map(entry => ({chapterIndex: entry.index, state: states[entry.index],
          title: entry.title, url: entry.url, cachedBytes: cachedBytes[entry.index], attempts: 3, maxAttempts: 3,
          lastError: lastErrors[entry.index]})) } };
      if (method === 'chapter.content') return { data: { sourceId, bookId, chapterTitle: `第${params.chapterIndex+1}章`,
        content: '这是一段已经缓存的有效正文，包含可供离线阅读的内容。', via: 'cache' } };
      if (method === 'cache.chapter.materialization.report') {
        states[params.chapterIndex] = params.outcome;
        lastErrors[params.chapterIndex] = params.errorCode;
        return { data: { sourceId, bookId, chapterIndex: params.chapterIndex,
          state: params.outcome, retainedCachedBody: true } };
      }
      throw Error(`unexpected request ${method}`);
    },
    async markOfflineImageChapterComplete(chapter) {
      if (failure === 'manifest') throw new ReadingOfflineMaterializationError('storage_full', 'fixture disk is full');
      manifests.add(chapter.chapterIndex);
    },
    async isOfflineImageChapterMaterialized(_source, _book, index) { return manifests.has(index); },
  };
}

async function finish(p) {
  for (let i=0;i<100 && p.offlineMutationActiveKey !== '';i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.offlineMutationActiveKey, '', 'production promise chain settled');
}

const results=[];
for (const mode of ['body','manifest','success']) {
  const book=session(mode === 'body' ? 25 : 3);
  const runtime=runtimeFor(book,mode), progress=[];
  const projection=await new ReadingOfflineGateway(runtime).prefetchBook(book, () => true,
    p => progress.push({ reportedCompleted: p.completedChapters, total: p.totalChapters,
      actuallyCompleted: p.entries.filter(e=>e.downloadState==='completed').length }));
  const pClass=productionMotionMethods(indexFile.pathname,['downloadDirectoryBook','showOfflineDownloadFeedback'],{
    ReadingOfflineGateway,ReaderRuntimeOwner:{current:()=>runtime},hilog:{error(){}},DOMAIN:0,
  });
  const messages=[],errors=[];
  const p=Object.assign(new pClass(), {remoteReadingSession:book,offlineMutationActiveKey:'',offlineMutationGeneration:0,
    detailToc:book.entries.map(e=>({index:e.index,title:e.title,navigable:true,downloadState:'missing'})),
    getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})}),
    mergeDirectoryBookmarks:entries=>entries,showReadingFailure:(...args)=>errors.push(args)});
  p.downloadDirectoryBook(); await finish(p);
  if(mode==='body'){p.downloadDirectoryBook();await finish(p);}
  if(mode==='success') assert.equal(messages.at(-1),'全部 3 章下载完成');
  else {
    assert.equal(errors.length,0,'failure detail is lost from the whole-book promise');
    assert.ok(messages.at(-1).startsWith('已下载 0/'));
    assert.equal(progress.at(-1).reportedCompleted,book.entries.length);
    assert.equal(progress.at(-1).actuallyCompleted,0);
  }
  results.push({mode,progress,projection:projection.map(e=>({index:e.index,state:e.downloadState})),
    messages,errors,lastErrors:runtime.lastErrors,cachedBytes:runtime.cachedBytes,
    requestMethods:runtime.calls.map(c=>c.method),prefetchRanges:runtime.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.params.chapterRange)});
}
const report={sourceHashes:{ReadingOfflineGateway:createHash('sha256').update(readFileSync(gatewayFile)).digest('hex'),
  Index:createHash('sha256').update(readFileSync(indexFile)).digest('hex')},
  evidenceBoundary:'Actual unchanged Host Gateway and Index methods with synthetic Core/Host I/O; no network/device. Fixture HTTP 403 is illustrative, not attribution of the user incident.',results};
writeFileSync(new URL('production-zero-download-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,scenarios:results.map(({mode,progress,messages,errors})=>({mode,progress,messages,errors}))},null,2));
