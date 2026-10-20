// Offline structure and state regression. No browser, network, Host or Core writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {screens as library,libraryBooks,applyLibrarySample} from './ui-library.mjs';
import {screens as settings,applySettingsSample,applySettingsAction,settingsSourceRecords} from './ui-settings.mjs';
import {screens as reading} from './ui-reading.mjs';
import {setDemoBook,bookForSample,readingFormVariant,sourceToolsSessionProtected} from './demo-state.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),host=path.resolve(here,'../../..'),workspace=path.dirname(host);
const screens=[...library,...settings,...reading],byId=new Map(screens.map(s=>[s.id,s]));
const checks=[],failures=[],rows=[],domainResults=[];
let routeGrammar;
const read=p=>fs.readFile(p,'utf8').then(JSON.parse),sha=data=>createHash('sha256').update(data).digest('hex');
const ctx=(variant='quick',book=libraryBooks[0],choices={},size='phone')=>({variant,book,choices,size,theme:'day',tablet:false,viewportWidth:size==='wide'?760:390,viewportHeight:844});
const render=(id,context)=>byId.get(id).render(context);
async function check(name,fn){try{await fn();checks.push(name);}catch(e){failures.push({name,error:e.stack||String(e)});}}
await check('current-source-and-design-binding',async()=>{
  const baseline=await read(path.join(here,'baseline.json')),delivery=await read(path.join(here,'delivery.json'));
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:host,encoding:'utf8'}).trim(),baseline.host.head);
  for(const[p,h]of Object.entries(baseline.inputs))assert.equal(sha(await fs.readFile(path.resolve(host,p))),h,`Source drift: ${p}`);
  for(const[p,h]of Object.entries(delivery.designInputs))assert.equal(sha(await fs.readFile(path.resolve(here,p))),h,`Design drift: ${p}`);
});
await check('typography-retains-aliases-inheritance-and-signed-spacing',async()=>{
  const delivery=await read(path.join(here,'delivery.json')),native=await fs.readFile(path.join(host,'entry/src/main/ets/features/common/ReaderTypography.ets'),'utf8');
  assert.equal(delivery.typography.length,[...native.matchAll(/export const TYPE_/g)].length);
  const roles=new Map(delivery.typography.map(t=>[t.role,t]));
  assert.equal(roles.get('TYPE_SOURCE_TOOLS_INHERITED_META').family,null);assert.equal(roles.get('TYPE_READER_SNIPPET_INLINE_MATCH').fontSize,null);assert.equal(roles.get('TYPE_FILE_IMPORT_ACTION').letterSpacing,-0.0762);
  assert.equal(roles.get('TYPE_FORM_ACTION').fontSize,roles.get('TYPE_SHELF_MANAGEMENT_BUTTON').fontSize);
});
await check('stylesheets-use-existing-local-assets',async()=>{
  for(const name of (await fs.readdir(here)).filter(n=>n.endsWith('.css'))){
    const css=await fs.readFile(path.join(here,name),'utf8');
    for(const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)){const resource=match[1];if(resource.startsWith('data:')||/^(https?:|#)/.test(resource))continue;await fs.access(path.resolve(here,resource.split(/[?#]/)[0]));}
  }
});
await check('domain-library-settings-and-reading-regressions',()=>{
  for(const domain of ['library','settings','reading','back-layout']){
    const result=spawnSync(process.execPath,[path.join(here,`coverage-evidence/${domain}-model-regression.mjs`)],{encoding:'utf8',maxBuffer:4*1024*1024});
    assert.equal(result.status,0,result.stderr||result.stdout);
    domainResults.push({domain,...JSON.parse(result.stdout.trim())});
  }
});
await check('all-return-controls-and-measured-font-budgets',()=>{
  const result=domainResults.find(r=>r.domain==='back-layout');assert(result);
  assert.equal(result.status,'PASS');assert.equal(result.stateCount,screens.reduce((n,s)=>n+s.variants.length,0));
  assert.equal(result.models.length,27);assert.equal(result.fontMetrics['10'],20);
  assert(result.returnOrCloseControls>0);assert(result.groups.some(g=>g.modules.includes('reader-search')));assert(result.groups.some(g=>g.modules.includes('reader-replace')));
});
await check('every-registered-state-renders-with-independent-context',async()=>{
  for(const screen of screens){
    for(const [variant,bg]of Object.entries(screen.backgroundByVariant||{})){assert(screen.variants.some(v=>v.id===variant));assert(byId.has(bg.background),`${screen.id}: invalid background schema`);if(bg.backgroundVariant)assert(byId.get(bg.background).variants.some(v=>v.id===bg.backgroundVariant));}
    for(const v of screen.variants){
      const book=bookForSample(libraryBooks,screen.id.startsWith('manga-')?'manga-'+v.id:v.id),choices={};
      setDemoBook(choices,book);applyLibrarySample(screen.id,v.id,choices);applySettingsSample(screen.id,v.id,choices);
      for(const size of ['phone','wide']){
        const html=screen.render(ctx(v.id,book,choices,size));
        assert.equal(typeof html,'string');assert(!html.includes('undefined')&&!html.includes('[object Object]'),`${screen.id}/${v.id}`);
        rows.push({id:screen.id,variant:v.id,size,html});
      }
    }
  }
});
await check('state-structure-uses-existing-assets-and-valid-actions',async()=>{
  const payload={rows,registry:screens.map(s=>({id:s.id,variants:s.variants.map(v=>v.id)})),host};
  const python='/Users/minliny/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
  const script=`import sys,json,os\nfrom lxml import html\np=json.load(sys.stdin);registry={s['id']:set(s['variants']) for s in p['registry']};errors=[];icons=set()\nfor row in p['rows']:\n root=html.fragment_fromstring(row['html'],create_parent='div');label=row['id']+'/'+row['variant']+'/'+row['size']\n for n in root.xpath('//*[@data-icon]'):\n  name=n.get('data-icon');icons.add(name)\n  if not os.path.isfile(p['host']+'/entry/src/main/resources/base/media/'+name+'.svg'):errors.append(label+': missing '+name)\n for n in root.xpath('//*[@data-action]'):\n  a=n.get('data-action');kind,_,target=a.partition(':')\n  if kind in ['go','open']:\n   if target not in registry:errors.append(label+': unknown '+a)\n   elif n.get('data-target-variant') and n.get('data-target-variant') not in registry[target]:errors.append(label+': invalid target variant '+a)\n  elif kind in ['variant','temporary'] and target not in registry[row['id']]:errors.append(label+': unknown local '+a)\n for n in root.xpath('//*[@role="switch"]'):\n  if not (n.get('aria-label') or n.get('aria-labelledby') or n.text_content().strip()):errors.append(label+': unnamed switch')\n  if n.get('aria-checked') not in ['true','false']:errors.append(label+': invalid switch value')\nprint(json.dumps({'errors':errors,'icons':len(icons),'parsedStates':len(p['rows'])}))`;
  const result=spawnSync(python,['-c',script],{input:JSON.stringify(payload),encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.errors,[]);
});
await check('local-book-remains-local-in-every-novel-control',()=>{
  const book=libraryBooks.find(b=>b.kind==='local'),choices={};setDemoBook(choices,book);
  for(const id of ['reader-controls','reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace']){
    const html=render(id,ctx('quick',book,choices));
    for(const tag of html.matchAll(/<button\b[^>]*data-action="open:source-switch"[^>]*>/g))assert(tag[0].includes('disabled'),`${id}: remote switch enabled`);
    assert(html.includes(book.title),`${id}: lost book title`);
  }
  const failure=render('reader',ctx('failed',book,choices));assert(!/data-action="open:source-switch"/.test(failure),'local failure offers source switch');
});
await check('active-control-icons-use-intended-theme-assets',async()=>{
  for(const[id,asset]of [['reader-directory','reader_directory_list_active'],['reader-tts','reader_tts_nav_active'],['reader-appearance','reader_appearance_nav_active'],['reader-settings','reader_settings_nav_active']]){
    const html=render(id,ctx('quick'));
    assert(html.includes(`data-icon="${asset}"`),`${id}: missing active icon`);
    for(const name of [asset,asset+'_theme_night'])assert((await fs.readFile(path.join(host,'entry/src/main/resources/base/media',name+'.svg'),'utf8')).includes('<svg'),name);
  }
});
await check('content-search-retains-query-results-and-full-outcomes',()=>{
  for(const state of ['results','loading','empty','error','more-loading','more-error','complete']){
    const screen=byId.get('reader-search');assert(screen.variants.some(v=>v.id===`full-${state}`));
    const html=render(screen.id,ctx(`full-${state}`));
    assert(html.includes('aria-label="搜索正文内容"'));assert(html.includes('reading-content-search-results'));
    if(['results','more-loading','more-error','complete'].includes(state))assert(html.includes('reading-search-match')&&html.includes('reading-search-result'));
  }
});
await check('auto-page-retains-state-units-and-action-carriers',()=>{
  for(const state of ['quick','full','running','paused','full-running','full-paused']){
    const html=render('reader-autopage',ctx(state));
    for(const asset of ['reader_auto_full_chevron_left','reader_auto_full_chevron_right','reader_auto_full_stop'])assert(html.includes(`data-icon="${asset}"`),state+'/'+asset);
    assert(html.includes('自动翻页')&&html.includes('秒'));
    if(state.includes('full'))assert(html.includes('自动停止分')&&html.includes('自动停止秒')&&html.includes('跟随高亮'));
    else assert(html.includes('reading-auto-quick-header'));
  }
  const running=render('reader-autopage',ctx('running'));assert(running.includes('data-icon="reader_session_pause"'));
  const paused=render('reader-autopage',ctx('paused'));assert(paused.includes('aria-label="继续自动翻页"'));
});
await check('tts-manager-save-gate-reacts-to-independent-drafts',()=>{
  const blank=render('reader-tts-manager',ctx('new'));assert(/<button[^>]*disabled[^>]*>保存<\/button>/.test(blank));
  const choices={'tts-manager-name':'测试服务','tts-manager-url':'https://service.example/tts','tts-manager-format':'WAV'};
  const ready=render('reader-tts-manager',ctx('new',libraryBooks[0],choices));assert(!/<button[^>]*disabled[^>]*>保存<\/button>/.test(ready));assert(ready.includes('value="测试服务"'));
  assert(/<button[^>]*disabled[^>]*>保存<\/button>/.test(render('reader-tts-manager',ctx('busy',libraryBooks[0],choices))));
});
await check('every-module-route-uses-upstream-mermaid-grammar',async()=>{
  // Grammar/database only. Plain local labels bypass DOM sanitization because no
  // HTML, links, browser layout or renderer is executed in this offline check.
  const {diagram}=await import('/private/tmp/reader-route-validation/node_modules/mermaid/dist/chunks/mermaid.core/flowDiagram-NV44I4VS.mjs');
  const {overview}=await import('./logic-overview.mjs');
  const graphs=[...overview.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(m=>({id:'overview',source:m[1]}));
  const routes={};
  for(const group of ['library','settings','reading'])Object.assign(routes,await read(path.join(here,`routes-${group}.json`)));
  assert.deepEqual(Object.keys(routes).sort(),screens.map(s=>s.id).sort());
  for(const[id,route]of Object.entries(routes))graphs.push({id,source:route.diagram});
  for(const graph of graphs){const db=diagram.db;db.sanitizeText=text=>text;diagram.parser.parser.yy=db;assert(diagram.parser.parse(graph.source),graph.id);assert(db.getVertices().size>0&&db.getEdges().length>0,graph.id);}
  routeGrammar={tool:'Mermaid 11.12.0 flowchart grammar/database',modules:screens.length,overviewDiagrams:graphs.length-screens.length,totalDiagrams:graphs.length,parsePassed:graphs.length,rendered:false,domSanitizationExecuted:false};
});
await check('book-context-and-form-do-not-leak-across-books',()=>{
  const choices={},manga=libraryBooks.find(b=>b.content==='manga'),novel=libraryBooks.find(b=>b.content==='novel'&&b.kind==='online');
  setDemoBook(choices,manga);assert.equal(choices['directory-fixture'],'manga');
  setDemoBook(choices,novel);assert.equal(choices['directory-fixture'],'novel');assert.equal(choices['selected-book'].id,novel.id);
  for(const screen of reading)for(const[full,quick]of Object.entries(screen.quickVariantByFull||{})){
    assert(screen.variants.some(v=>v.id===full),`${screen.id}/${full}`);assert(screen.variants.some(v=>v.id===quick),`${screen.id}/${quick}`);
    assert.equal(readingFormVariant(screen,full,'quick'),quick);
    assert.equal(readingFormVariant(screen,quick,'full'),full);
  }
});
await check('shelf-filter-and-view-share-state-without-reset',()=>{
  const choices={};applyLibrarySample('bookshelf','cover',choices);
  choices['library-content-filter']='manga';choices['library-view']='list';
  const html=render('shelf-filter',ctx('default',libraryBooks[0],choices));
  assert(html.includes('sample-online-manga'));assert(!html.includes('data-book-id="sample-local-novel"'));assert(html.includes('lib-book-list'));
  choices['library-content-filter']='all';choices['library-source-filter']='all';
  const all=render('bookshelf',ctx('cover',libraryBooks[0],choices));assert(all.includes('sample-local-novel'));assert(all.includes('lib-book-list'));
});
await check('source-row-action-is-bound-to-the-selected-id',()=>{
  const choices={};applySettingsSample('sources','default',choices);const before=settingsSourceRecords(choices).map(s=>({...s}));
  applySettingsAction('source:check',choices,{sourceId:before[1].sourceId});const after=settingsSourceRecords(choices);
  assert.equal(after[1].checkState,'checking');assert.equal(after[0].checkState,before[0].checkState);
  applySettingsAction('source:toggle',choices,{sourceId:before[1].sourceId,enabled:false});assert.equal(settingsSourceRecords(choices)[1].enabled,false);
});
await check('preferences-and-task-result-coexist',()=>{
  const choices={};applySettingsSample('general','theme-night',choices);applySettingsSample('general','auto-check-off',choices);applySettingsSample('general','reduce-motion',choices);applySettingsSample('general','cache-success',choices);
  assert.equal(choices['settings-theme-mode'],'night');assert.equal(choices['settings-auto-update'],false);assert.equal(choices['settings-reduce-motion'],true);assert.equal(choices['settings-cache-state'],'cache-success');
  applySettingsSample('general','reset-busy',choices);assert(render('settings',ctx('default',libraryBooks[0],choices)).includes('fieldset'));
});
await check('editor-debug-and-batch-output-keep-their-own-state',()=>{
  const choices={'source-editor-draft':'{"kept":"draft"}','source-check-mode':'search','source-check-depth':'2'};
  applySettingsSample('source-tools','editor',choices);applySettingsSample('source-tools','debug-passed',choices);
  choices['source-check-mode']='explore';choices['source-check-depth']='5';
  applySettingsSample('source-tools','enable-success',choices);
  assert.equal(choices['source-editor-draft'],'{"kept":"draft"}');assert.equal(choices['source-editor-open'],true);assert.equal(choices['source-debug-state'],'debug-passed');assert.equal(choices['source-debug-result-mode'],'search');assert.equal(choices['source-debug-result-depth'],2);
  applySettingsSample('source-tools','check-complete',choices);assert.equal(choices['source-editor-open'],true);
});
await check('tool-reentry-preserves-pending-and-unknown-session-only',()=>{
  for(const choices of [{'source-tools-busy':true},{'source-editor-save-unknown':true},{'source-recovery-snapshot':{unknown:true}},{'source-recovery-state':'receipt-refresh-failed'}])assert.equal(sourceToolsSessionProtected(choices),true);
  for(const choices of [{},{'source-editor-readback-failed':true},{'source-recovery-snapshot':{blocked:true,busy:true,cleanup:true}}])assert.equal(sourceToolsSessionProtected(choices),false);
  const choices={'source-editor-source':'kept','source-editor-draft':'kept raw'};applySettingsSample('source-tools','editor-save-unknown',choices);assert(sourceToolsSessionProtected(choices));assert.equal(choices['source-editor-draft'],'kept raw');
});
await check('actual-native-grabber-policy-handles-expand-collapse-dismiss-cancel',async()=>{
  let esbuild;try{esbuild=await import('esbuild');}catch{esbuild=await import(path.join(workspace,'evidence/opensource-completion/renderer-pilot/node_modules/esbuild/lib/main.js'));}
  const bundle=await esbuild.build({entryPoints:[path.join(here,'control-gesture.mjs')],bundle:true,format:'esm',write:false,target:'es2020'});
  const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const bounds={width:364,fullHeight:736,quickHeight:330,bottomGap:19};
  const run=(form,delta,type='up')=>{const c=api.createDemoControlGesture('directory',form,bounds,88,true);api.updateDemoControlGesture(c,'down',1,500,0);api.updateDemoControlGesture(c,'move',1,500+delta,100);api.updateDemoControlGesture(c,type,1,500+delta,110);return c;};
  assert.equal(run('quick',-100).session.location.form,'full');assert.equal(run('full',100).session.location.form,'quick');
  assert.equal(run('quick',20).session.location.level,'hidden');assert.equal(run('quick',-100,'cancel').session.location.form,'quick');
  assert.equal(api.mangaPanelDragDismiss(96,550),false);assert.equal(api.mangaPanelDragDismiss(97,0),true);assert.equal(api.mangaPanelDragDismiss(0,551),true);assert.equal(api.mangaPanelDragDismiss(200,800,true),false);
});
const delivery=await read(path.join(here,'delivery.json'));
const testInputs={};for(const domain of ['library','settings','reading','back-layout'])testInputs[`coverage-evidence/${domain}-model-regression.mjs`]=sha(await fs.readFile(path.join(here,`coverage-evidence/${domain}-model-regression.mjs`)));
const result={schemaVersion:1,checkedAt:new Date().toISOString(),scope:'Offline generated markup + independent demo model + actual native gesture policy; no browser/visual acceptance',sourceTreeSha256:delivery.sourceTreeSha256,designSourceSha256:delivery.designSourceSha256,logicSha256:sha(await fs.readFile(path.join(here,'LOGIC.md'))),moduleCount:screens.length,stateCount:screens.reduce((n,s)=>n+s.variants.length,0),renderedStates:rows.length,domainResults,routeGrammar,testInputs,checks,failures,browser:false,nativeVisual:false,backend:false};
await fs.writeFile(path.join(here,'coverage-evidence/repair-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
