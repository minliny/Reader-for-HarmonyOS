import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { screens, libraryBooks, applyLibrarySample } from '../ui-library.mjs';
import { specifications } from '../spec-library.mjs';
const base=new URL('../../../../',import.meta.url).pathname.replace(/\/$/,'');
const byId=new Map(screens.map(s=>[s.id,s]));
const render=(id,variant,choices={},book=libraryBooks[0],size='phone')=>byId.get(id).render({variant,choices,book,size});
const seeded=(id,variant)=>{const choices={};applyLibrarySample(id,variant,choices);return choices;};
assert.equal(libraryBooks.length,3);assert.equal(new Set(libraryBooks.map(b=>b.id)).size,3);
let renders=0,sourceRefs=0,icons=new Set();
for(const screen of screens){
 assert.ok(specifications[screen.id],`No spec: ${screen.id}`);
 for(const variant of screen.variants)for(const size of ['small','phone','wide'])for(const scheme of ['day','night']){
   const book=variant.id==='local'?libraryBooks[1]:variant.id.startsWith('manga')?libraryBooks[2]:libraryBooks[0];
   const output=screen.render({variant:variant.id,choices:seeded(screen.id,variant.id),book,size,scheme});
   assert.equal(typeof output,'string');assert.ok(output.includes('class='));assert.ok(!output.includes('undefined'),`${screen.id}/${variant.id} undefined`);
   for(const [,asset]of output.matchAll(/data-icon="([^"]+)"/g))icons.add(asset);
   renders++;
 }
 for(const ref of [...screen.source,...specifications[screen.id].sources]){
   const file=path.join(base,ref.path);assert.ok(fs.existsSync(file),ref.path);
   const lines=fs.readFileSync(file,'utf8').split('\n');assert.ok(ref.line>0&&ref.line<=lines.length,`${ref.path}:${ref.line}`);sourceRefs++;
 }
}
for(const icon of icons)assert.ok(fs.existsSync(`${base}/entry/src/main/resources/base/media/${icon}.svg`),icon);
assert.ok(!byId.has('library-error'));assert.ok(!specifications['library-error']);
const shelf=render('bookshelf','cover',seeded('bookshelf','cover'));
for(const book of libraryBooks)assert.ok(shelf.includes(`data-book-id="${book.id}" data-book-kind="${book.kind}" data-book-content="${book.content}" data-book-index="${book.index}"`));
assert.ok(shelf.includes('data-popup-anchor="shelf-more"'));
assert.equal((shelf.match(/class="lib-book-cover /g)||[]).length,3); // continue + two covers
assert.ok(shelf.includes('暂无封面'));
const filtered=seeded('shelf-filter','active');filtered['library-view']='list';
let html=render('shelf-filter','active',filtered);
assert.ok(html.includes('lib-book-list'));assert.ok(html.includes('sample-online-novel'));assert.ok(!html.includes('sample-local-novel'));assert.ok(!html.includes('sample-online-manga'));
filtered['library-content-filter']='manga';filtered['library-source-filter']='local';
html=render('shelf-filter','active',filtered);assert.ok(html.includes('没有符合条件的书籍'));assert.ok(html.includes('library:clear-filters'));
assert.equal(filtered['library-content-filter'],'manga'); // render never resets a local choice
html=render('multiselect','selected',{'library-selection':4,'library-source-filter':'online'},libraryBooks[2]);
assert.ok(html.includes('已选择 1 本'));assert.ok(html.includes('data-book-index="2"'));assert.ok(!html.includes('data-book-index="1"'));assert.ok(html.includes('data-choice-value="5"'));assert.ok(!html.includes('library-selection-selected'));
const search=seeded('search','results');html=render('search','results',search);assert.ok(html.indexOf('class="lib-result-summary"') < html.indexOf('class="app-scroll lib-search-scroll'));assert.ok(!html.slice(html.indexOf('class="app-scroll lib-search-scroll')).includes('class="lib-result-summary"'));
const streaming=render('search','searching',seeded('search','searching'));assert.ok(streaming.includes('</div><div class="lib-search-actor">'));assert.ok(streaming.includes('<p class="quiet">'));const loadingSearch=render('search','loading');assert.ok(loadingSearch.includes('lib-search-scroll "></div><div class="lib-search-actor">'));assert.ok(!loadingSearch.includes('lib-search-loading'));html=render('search','results',search);
assert.equal((html.match(/class="lib-search-result"/g)||[]).length,3);assert.equal((html.match(/class="lib-result-intro"/g)||[]).length,2);
search['library-search-category']='local';search['library-search-content']='manga';search['library-search-draft']='编辑中的关键词';
html=render('search','results',search);assert.ok(html.includes('当前筛选（本地 · 漫画）'));assert.ok(html.includes('value="编辑中的关键词"'));assert.ok(!html.includes('class="lib-search-result"'));
search['library-search-draft']='';search['library-search-category']='online';search['library-search-content']='all';html=render('search','results',search);assert.ok(html.includes('找到 <strong>2</strong>'));assert.ok(!html.includes('aria-label="清空搜索内容"'));assert.ok(html.includes('empty-draft'));assert.ok(html.includes('disabled>搜索'));
for(const book of libraryBooks){
 html=render('detail',book.kind==='local'?'local':'saved',{},book);
 assert.ok(html.includes(`<h2>${book.title}</h2>`));assert.ok(html.includes(`data-book-id="${book.id}"`));
 if(book.kind==='local')assert.ok(!html.includes('data-action="open:source-switch"'));
 const actions=render('book-actions',book.kind==='local'?'local':'default',{},book);assert.equal((actions.match(new RegExp(`data-book-id="${book.id}"`,'g'))||[]).length,4);
}
html=render('detail','manga-unread',{},libraryBooks[2]);assert.ok(html.includes('尚未开始阅读'));assert.ok(html.includes('data-book-position="none"'));assert.ok(!html.includes('3 / 12 页'));
html=render('detail','saved',{'library-detail-fold:sample-online-manga':true},libraryBooks[2]);assert.ok(html.includes('lib-detail-group'));assert.equal((html.match(/data-reader-chapter=/g)||[]).length,0);
html=render('detail','catalog-empty');assert.ok(html.includes('暂无章节信息'));assert.ok(!html.includes('282'));
html=render('detail','catalog-nonnavigable');assert.ok(html.includes('data-choice="library-detail-fold:sample-online-novel"'));assert.ok(!html.includes('go:reader" data-reader-chapter="0"'));
html=render('detail','removing',{},libraryBooks[2]);for(const button of html.matchAll(/<button\b[^>]*>/g))if(button[0].includes('data-reader-chapter=')||button[0].includes('go:directory'))assert.ok(button[0].includes('disabled'));
for(const state of ['remove-unknown','remove-confirmed-cleanup','shelf-refresh-pending','local-cleanup-warning']){html=render('bookshelf',state);assert.ok(html.includes('lib-recovery-notice'));assert.ok(!html.includes('alertdialog'));}
html=render('local-import','long-result');assert.equal((html.match(/lib-import-doc-icon/g)||[]).length,20);for(const slot of ['result','result-scroll','header','summary','items','footer','list-slot'])assert.ok(html.includes(`data-import-${slot}`),slot);
const menu=render('shelf-more','default');assert.ok(menu.includes('data-anchored-popup="shelf-more"'));assert.ok(menu.includes('points="0,12 12,0 24,12"'));
const css=fs.readFileSync(`${base}/docs/ui-design/app-baseline/library.css`,'utf8');assert.ok(!css.includes('top:64px;right:20px'));assert.ok(!css.includes('.lib-shelf-more:before'));assert.ok(css.includes('width:min(96.656px,calc((100% - 16px)/3))'));assert.ok(!css.includes('.viewport .lib-detail-actions{'));assert.ok(!css.includes('.viewport[data-size=wide] .lib-detail-actions{'));assert.ok(!css.includes('lib-search-loading'));assert.ok(!css.includes('.viewport .viewport')); assert.ok(css.includes('.viewport .lib-multiselect-scroll>.lib-book-list{max-width:none}'));
for(const width of [320,352,390]){const content=Math.min(352,width-38),card=Math.min(96.656,(content-16)/3),gap=Math.min(30,Math.max(8,(content-card*3)/2));assert.ok(card*3+gap*2<=content+1e-8,`overflow ${width}`);}
const routes=JSON.parse(fs.readFileSync(`${base}/docs/ui-design/app-baseline/routes-library.json`,'utf8'));assert.equal(Object.keys(routes).length,screens.length);assert.ok(!routes['library-error']);for(const id of byId.keys())assert.ok(routes[id]?.diagram);
const result={screens:screens.length,variants:screens.reduce((n,s)=>n+s.variants.length,0),renders,sourceRefs,icons:icons.size,checks:['stable route identities and preselection bits','local filters/category/draft/toggle contracts','current detail novel/manga structure and non-readable groups','receipt feedback stays in original shelf','cover and intro branch presence','measured import slots and 20-row structure','fixed search statistics and independent sweep actor structure','source refs in current files','320/352/390 grid geometry formula','no obsolete dock CSS overrides; narrow selection list retains horizontal access'],visualVerification:'not performed; browser/file access restriction retained'};
console.log(JSON.stringify(result));
