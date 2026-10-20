import { esc, icon, button, pageHeader, dialog, segments, field } from './shared.mjs';

const nativeRoot='../../../evidence/2026-10-06-native-ui-redo/captures/';
const shelfCapture='reader-control-redo-034-bookshelf';
const books=[
  {id:'novel',title:'斗破苍穹',author:'天蚕土豆',kind:'小说',origin:'在线',chapter:'第三章 客人',latest:'《斗破苍穹：斗帝之路》手游·角色传记（下）',progress:.17,cover:{x:67,y:1580,w:167,h:253}},
  {id:'manga',title:'斗破苍穹',author:'知音漫客 x 任翔',kind:'漫画',origin:'在线',chapter:'06 · 第 5 页 / 24 页',latest:'✿·\n番外02 血铸灵丹（下）',progress:.88,cover:{x:67,y:1867,w:167,h:253}},
];
function cover(book,className=''){
  const c=book.cover;
  // Only the independently captured cover pixels are used as content imagery.
  // All page text, controls, containers and navigation remain real DOM actors.
  return `<span class="library-cover ${esc(className)}"><img src="${nativeRoot}${shelfCapture}.png" alt="${esc(book.title)}${esc(book.kind)}封面" style="width:${1280/c.w*100}%;height:${2832/c.h*100}%;left:${-c.x/c.w*100}%;top:${-c.y/c.h*100}%"></span>`;
}
function shelfHeader(){return `<header class="library-top-bar"><button class="library-icon-button" data-go="search" aria-label="搜索书籍">${icon('bookshelf_search',24)}</button><h1>书架</h1><button class="library-icon-button" data-go="shelf-more" aria-label="书架更多">${icon('rc_dots',24)}</button></header>`;}
function shelfNav(){return `<nav class="library-tab-bar" aria-label="主导航"><button class="active" data-go="bookshelf" data-variant="list-filter">${icon('bookshelf_library_active',24)}<span>书架</span></button><button data-go="settings">${icon('bookshelf_settings_outline',24)}<span>设置</span></button></nav>`;}
function comicLatest(ctx){return ctx.variant==='list-comic-latest'||ctx.state['library-latest-reading']==='manga';}
function continueCard(ctx){const book=books[comicLatest(ctx)?1:0];return `<section class="library-continue"><h2>继续阅读</h2><button class="library-continue-card" data-action="read-${book.id}">${cover(book)}<span class="library-continue-meta"><strong>${esc(book.title)}</strong><span>${esc(book.author)}</span><span>${esc(book.id==='manga'?'06 · 5 页 / 24 页':book.chapter)}</span></span><span class="library-read-pill">阅读</span></button></section>`;}
function chips(items,value,key){return `<div class="library-filter-chips">${items.map(([id,label])=>`<button class="${id===value?'selected':''}" data-action="filter:${esc(key)}:${esc(id)}">${esc(label)}</button>`).join('')}</div>`;}
function filterPanel(ctx){
  const type=ctx.state['library-filter-content']||'all',origin=ctx.state['library-filter-origin']||'all';
  return `<section class="library-filter"><header><span>筛选</span><button data-action="clear-filters" ${type==='all'&&origin==='all'?'disabled':''}>清除</button></header><span class="library-filter-label">内容类型</span>${chips([['all','全部'],['novel','小说'],['manga','漫画']],type,'content')}<span class="library-filter-label">来源</span>${chips([['all','全部'],['local','本地'],['online','在线']],origin,'origin')}</section>`;
}
function bookList(book){return `<article class="library-book-row"><button class="library-book-cover-touch" data-action="read-${book.id}" aria-label="阅读${esc(book.kind)}斗破苍穹">${cover(book)}</button><button class="library-list-meta" data-action="read-${book.id}"><span class="library-list-title"><strong>${esc(book.title)}</strong><span class="library-tags"><span>${esc(book.kind)}</span><span>${esc(book.origin)}</span></span></span><span class="library-list-author">${esc(book.author)}</span><span class="library-list-chapter">${esc(book.chapter)}</span><span class="library-list-progress-text"><span>最新：${esc(book.latest)}</span><span>已读 &lt;1%</span></span><span class="library-progress-track"><i style="width:${book.progress}%;min-width:3px"></i></span></button><button class="library-book-more" data-action="book-menu-${book.id}" aria-label="${esc(book.kind)}斗破苍穹更多操作">${icon('bookshelf_more',44)}</button></article>`;}
function shelfView(ctx){
  const mode=ctx.state['settings-bookshelf-mode']||(ctx.variant==='cover'?'cover':'list');
  const expanded=ctx.state['library-filter-expanded']??(ctx.screen==='bookshelf'?['list-filter','list-comic-latest'].includes(ctx.variant):true);
  const type=ctx.state['library-filter-content']||'all',origin=ctx.state['library-filter-origin']||'all';
  const ordered=comicLatest(ctx)?[books[1],books[0]]:books;
  const visible=ordered.filter(book=>(type==='all'||type===book.id)&&(origin==='all'||origin==='online'));
  return `<section class="library-view" aria-label="书架"><div class="library-scroll library-shelf-content" data-scroll-key="library-bookshelf">${continueCard(ctx)}<header class="library-section-bar"><h2>我的书架</h2><div><button class="library-section-action ${mode==='cover'?'selected':''}" data-action="view-cover" aria-label="封面显示">${icon(mode==='cover'?'bookshelf_grid':'bookshelf_grid_outline',20)}</button><button class="library-section-action ${mode==='list'?'selected':''}" data-action="view-list" aria-label="列表显示">${icon(mode==='list'?'bookshelf_list_active':'bookshelf_list',20)}</button><button class="library-section-action ${expanded?'selected':''}" data-action="toggle-filter" aria-label="${expanded?'收起':'展开'}筛选">${icon(expanded?'bookshelf_filter_active':'bookshelf_filter',20)}</button></div></header>${expanded?filterPanel(ctx):''}<div class="${mode==='cover'?'library-grid':'library-list'}">${mode==='cover'?visible.map(book=>`<button class="library-grid-book" data-action="read-${book.id}">${cover(book)}<strong>${esc(book.title)}</strong><span>${esc(book.author)}</span><span>已读 &lt;1%</span></button>`).join(''):visible.map(bookList).join('')}</div></div>${shelfHeader()}${shelfNav()}</section>`;
}
function bookActionsView(ctx){return `${shelfView(ctx)}<div class="library-book-action-scrim"><button class="library-sheet-dismiss" data-action="close-book-actions" aria-label="关闭书籍操作"></button><section class="library-book-sheet" role="dialog" aria-modal="true" aria-label="书籍操作"><i class="library-sheet-grabber"></i><h2>书籍操作</h2><div class="library-sheet-actions">${[['multiselect','多选'],['book-info','书籍信息'],['group','编辑分组'],['remove','移除书架']].map(([action,label])=>`<button class="${action==='remove'?'danger':''}" data-action="book-action:${action}">${label}</button>`).join('')}</div></section></div>`;}
function shelfMoreView(ctx){return `${shelfView(ctx)}<div class="library-more-overlay"><button class="library-more-dismiss" data-action="close-shelf-more" aria-label="关闭更多"></button><section class="library-more-menu" aria-label="书架更多"><i class="library-more-pointer"></i>${[
  ['批量管理','bookshelf_more_batch','multiselect'],['本地导入','bookshelf_more_import','local-import'],['检查更新','settings_gen_refresh',null],['书架设置','bookshelf_more_settings','settings-bookshelf']
].map(([label,asset,go])=>`<button data-action="${go?`shelf-menu:${go}`:'check-updates'}">${icon(asset,24)}<span>${label}</span></button>`).join('')}</section></div>`;}
const searchHistory=['斗破苍穹','间谍过家家','山海纪行','guimizhizhu'];
const nativeIntro='这里是属于斗气的世界，没有花俏艳丽的魔法，有的，仅仅是繁衍到巅峰的斗气！\n新书等级制度：斗者，斗师，大斗师，斗灵，斗王，斗皇，斗宗，斗尊，斗圣，斗帝。\n……';
const textChapters=['第一章 陨落的天才','第二章 斗气大陆','第三章 客人','第四章 云岚宗','第五章 聚气散','第六章 炼药师','第七章休！','第八章 神秘的老者','第九章 药老！','第十章 借钱','第十一章 坊市','第十二章 离他远点','第十三章 黑铁片','第十四章 吸掌','第十五章 修炼','第十六章 萧宁','第十七章 冲突'];
function capturedCover(captureId,region,alt,className=''){
  const [x,y,w,h]=region;
  return `<span class="library-cover ${esc(className)}"><img src="${nativeRoot}${captureId}.png" alt="${esc(alt)}" style="width:${1280/w*100}%;height:${2832/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></span>`;
}
function searchBar(ctx){
  const live=ctx.variant==='searching';
  const query=ctx.state['library-search-query']??(ctx.variant==='initial'?'':'斗破苍穹');
  return `<header class="library-search-bar"><button class="library-search-back" data-back="true" aria-label="返回">${icon('search_back',20)}</button><label class="library-search-field">${icon('search_mag',14)}<input type="search" data-field="library-search-query" value="${esc(query)}" placeholder="搜索书名、作者..." aria-label="搜索书名或作者"><button data-action="search-clear" aria-label="清空搜索内容" ${query?'':'hidden'}>${icon('search_clear',14)}</button></label><button class="library-search-submit ${live?'is-searching':''}" data-action="${live?'search-stop':'search-submit'}">${live?'<i class="library-search-spinner"></i>':''}${live?'停止':'搜索'}</button></header>`;
}
const stoppedResults=[
  {title:'斗破苍穹',author:'天蚕土豆',latest:books[0].latest,intro:nativeIntro,source:'阅读助手（优+++）',count:22,saved:true,cover:[63,666,308,421],top:174.857,metaHeight:136.286},
  {title:'斗破苍穹',author:'知音漫客 任翔',kind:'manga',source:'包子漫画（优+）',count:1,cover:[63,1189,308,421],top:378,metaHeight:120.286},
  {title:'斗破苍穹',author:'任翔',kind:'manga',latest:'最新 · 第914话 攻城战',source:'🌟七七漫画',count:1,cover:[63,1712,308,421],top:520,metaHeight:120.286},
  {title:'斗破苍穹',author:'奕小婷',intro:'简介：\n7万亿年前，天地混沌初开，星球坠落，天狼星人司柏武聚能量原力注入阳星球，使其发出巨大能量，其他星球不再陨落，而天狼星球人散识被漂泊在宇宙四处，杨蕾聚齐族人意识暂定落水星，使得族人休养生息，却因为离太阳太近，族人皆被异化，其中地球吸取能量，渐渐博发生机。',source:'晋江wap',count:1,top:638.571,metaHeight:120.286},
];
const liveResults=[
  {title:'斗破苍穹',author:'天蚕土豆',latest:books[0].latest,intro:'🧾 总字数：533.23万字\n🎖️书友：2131.94万...',source:'66书吧-起点',count:1,saved:true,cover:[63,667,308,421],top:174.857,metaHeight:136.286},
  {title:'斗破苍穹之雷霆震碎',author:'一贫如洗羊羊',latest:'第816章 你们已有取死之道！',intro:'🧾 总字数：173.15万字\n🎖️书友：2.87万...',source:'66书吧-起点',count:1,cover:[63,1190,308,421],top:343.143,metaHeight:120.286},
  {title:'斗破苍穹之帝子萧炎',author:'馄饨城主',latest:'新书：《斗破：重生萧炎，没有遗憾》',intro:'🧾 总字数：219.91万字\n🎖️书友：20.24万...',source:'66书吧-起点',count:1,cover:[63,1713,308,421],top:492.571,metaHeight:120.286},
  {title:'斗破苍穹神之炎帝',author:'柠檬邱霞',latest:'开新书了（全职法师之亡灵罹难者）',intro:'🧾 总字数：650.18万字\n🎖️书友：6.29万...',source:'66书吧-起点',count:1,cover:[63,2236,308,421],top:642,metaHeight:120.286},
];
function searchResult(book,index,live){
  const capture=live?'reader-control-redo-051-library-search-results':'reader-control-redo-052-library-search-stopped';
  return `<article class="library-search-result ${book.kind==='manga'?'is-manga':''}" style="--meta-height:${book.metaHeight}px"><button class="library-result-touch" data-action="search-result:${index}:${live?'live':'stopped'}" aria-label="打开${esc(book.title)}详情">${book.cover?capturedCover(capture,book.cover,book.title,'library-result-cover'):`<span class="library-result-cover library-cover-placeholder"><span>${esc(book.title)}</span></span>`}<span class="library-result-meta">${book.kind==='manga'?'<span class="library-result-kind"><i>漫画</i><i>在线</i></span>':''}<span class="library-result-copy"><strong>${esc(book.title)}</strong><span>${esc(book.author)}</span>${book.latest?`<span class="library-result-latest">${esc(book.latest)}</span>`:''}${book.intro?`<span class="library-result-intro">${esc(book.intro)}</span>`:''}</span><span class="library-result-tags">${book.kind!=='manga'?'<i>小说</i>':''}<i>${esc(book.source)}</i><i class="muted">已发现 ${book.count} 个书源</i>${book.saved?'<i>已在书架</i>':''}</span></span></button></article>`;
}
function searchView(ctx){
  const initial=ctx.variant==='initial',live=ctx.variant==='searching';
  const content=initial?`<div class="library-search-history"><header><h2>最近搜索</h2><button data-action="search-clear-history">清空记录</button></header><div>${searchHistory.map((word,index)=>`<button style="width:${[82.571,95.429,82.571,104.286][index]}px" data-action="search-history:${esc(word)}">${esc(word)}</button>`).join('')}</div></div>`:`<div class="library-search-stats">找到 <strong>${live?'20':'775'}</strong> 本相关书籍 · ${live?'正在搜索 3/127 个书源,已返回 20 个':'已停止,已搜索 97/127 个书源'}<button data-action="search-retry"> · 失败 ${live?'1':'28'} 个书源${live?'':'，重试'}</button></div><div class="library-search-results">${(live?liveResults:stoppedResults).map((book,index)=>searchResult(book,index,live)).join('')}<div class="library-result-partial">${live?'斗破苍穹之财动乾坤':'斗破苍穹'}</div></div>`;
  return `<section class="library-view library-search-view" aria-label="搜索书籍"><div class="library-scroll library-search-scroll" data-scroll-key="library-search-${ctx.variant}">${content}</div>${searchBar(ctx)}${initial?'':`<div class="library-search-scopes"><div><span>来源</span>${[['all','全部'],['local','本地'],['online','在线']].map(([id,label])=>`<button class="${id==='all'?'selected':''}" data-action="search-scope:${id}">${label}</button>`).join('')}</div><div><span>内容类型</span>${[['all','全部类型'],['novel','小说'],['manga','漫画']].map(([id,label])=>`<button class="${id==='all'?'selected':''}" data-action="search-type:${id}">${label}</button>`).join('')}</div></div>`}</section>`;
}
function detailView(ctx){if(ctx.variant==='manga')return comicDetailView(ctx);return `<section class="library-view library-detail-view" aria-label="书籍详情"><div class="library-scroll library-detail-content" data-scroll-key="library-detail"><section class="library-detail-summary">${capturedCover('reader-control-redo-053-book-detail-search',[70,402,294,427],'斗破苍穹封面','library-detail-cover')}<div><h2>斗破苍穹</h2><span>天蚕土豆</span><div><i>小说</i><i>在线</i></div></div></section><section class="library-detail-source"><span>当前来源：书源名称暂不可用</span><button data-action="detail-switch-source">换源</button></section><p class="library-detail-latest">最新：《斗破苍穹：斗帝之路》手游·角色传记（下）</p><section class="library-detail-intro"><h3>简介</h3><p>${esc(nativeIntro)}</p><button data-action="detail-expand">展开</button></section><section class="library-detail-directory"><header><h3>目录</h3><span>1663 个可读条目</span><button data-go="directory" data-variant="text">${icon('book_detail_directory',20)}完整目录</button></header>${textChapters.slice(0,5).map((title,index)=>`<button data-action="detail-chapter:${index}">${esc(title)}</button>`).join('')}</section></div><header class="library-detail-header"><button data-action="detail-back" aria-label="返回">${icon('book_detail_back',24)}</button><h1>书籍详情</h1><span></span></header><nav class="library-detail-dock"><button data-action="detail-read">继续阅读</button><button data-action="detail-remove">移除书架</button></nav></section>`;}
function directoryTools(ctx,comic=false){return `<label>${icon('reader_directory_input_search',16)}<input data-field="library-directory-query" value="${esc(ctx.state['library-directory-query']||'')}" placeholder="${comic?'搜索话／卷名称':'搜索章节名称'}" aria-label="${comic?'搜索话或卷名称':'搜索章节名称'}"></label>${[['search','搜索','reader_directory_search'],['top','到顶部','reader_directory_top'],['bottom','到底部','reader_directory_bottom'],['sort','升序','reader_directory_sort_ascending']].map(([id,label,asset])=>`<button data-action="directory-${id}" aria-label="${label}">${icon(asset,16)}</button>`).join('')}`;}
function directoryView(ctx){if(ctx.variant==='manga')return comicDirectoryView(ctx);return `<section class="library-view library-directory-view" aria-label="详情独立完整目录"><header class="library-directory-header"><button data-back="true" aria-label="返回">${icon('search_back',24)}</button><h1>目录</h1></header><div class="library-directory-toolbar">${directoryTools(ctx)}</div><div class="library-scroll library-directory-list" data-scroll-key="library-directory-text">${textChapters.map((title,index)=>`<article><button class="library-directory-title" data-action="directory-chapter:${index}">${esc(title)}</button><button data-action="directory-download:${index}" aria-label="下载${esc(title)}">${icon('reader_directory_marker_download',15)}</button><button data-action="directory-bookmark:${index}" aria-label="为${esc(title)}添加书签">${icon('reader_directory_marker_bookmark',15)}</button></article>`).join('')}</div></section>`;}
const comicIntro='更新时间：2026.08.01\n\n斗破苍穹是知音漫客 x 任翔创作的古风漫画，正所谓三十年河东三十年河西，天才少年因忽然失去了天生的灵力，被所有人嘲笑排挤，为腾讯动漫独家正版连载，下拉式免费在线阅读，App追更抢先看。';
function comicDetailView(ctx){return `<section class="library-view library-detail-view library-comic-detail" aria-label="漫画书籍详情"><div class="library-scroll library-detail-content" data-scroll-key="library-detail-manga"><section class="library-comic-hero">${capturedCover('reader-control-redo-072-comic-detail',[70,402,364,525],'斗破苍穹漫画封面','library-comic-cover')}<div><span class="library-comic-tags"><i>漫画</i><i>在线</i></span><h2>斗破苍穹</h2><span class="library-comic-author">知音漫客 x 任翔</span><span class="library-comic-source"><span>当前来源：🔖腾讯漫画</span><button data-go="source-switch" data-variant="comic-detail-empty">换源</button></span><span class="library-comic-latest">最新：番外02 血铸灵丹（下）</span></div></section><section class="library-comic-position"><span>上次读到</span><p><strong>06</strong><span>5 / 24 页</span></p></section><section class="library-detail-intro"><h3>简介</h3><p>${esc(comicIntro)}</p><button data-action="detail-expand">展开</button></section><section class="library-detail-directory"><header><h3>章节目录</h3><span>681 个可读条目</span><button data-go="directory" data-variant="manga">${icon('book_detail_directory',20)}完整目录</button></header>${['01','02','03'].map((title,index)=>`<button data-action="detail-chapter:${index}">${title}</button>`).join('')}</section></div><header class="library-detail-header"><button data-action="detail-back" aria-label="返回">${icon('book_detail_back',24)}</button><h1>书籍详情</h1><span></span></header><nav class="library-detail-dock"><button data-action="detail-read">继续阅读</button><button data-action="detail-remove">移除书架</button></nav></section>`;}
function comicDirectoryView(ctx){return `<section class="library-view library-comic-directory" aria-label="漫画独立完整目录"><div class="library-scroll library-comic-directory-list" data-scroll-key="library-directory-manga">${['01','02','03','04','05','06','07'].map((title,index)=>`<article class="${title==='06'?'current':''}"><button data-action="directory-comic-chapter:${index}">${title}</button><button data-action="directory-comic-download:${index}" aria-label="管理第${title}话下载">${icon('reader_directory_marker_download',15)}</button>${title==='06'?'<span>正在读</span>':''}</article>`).join('')}</div><header class="library-comic-directory-header"><button data-back="true" aria-label="返回">${icon('search_back',24)}</button><h1>目录</h1><button data-go="download-management" data-variant="book-ready" aria-label="整书下载更多">${icon('reader_directory_more',20)}</button></header><section class="library-comic-directory-card"><h2>斗破苍穹</h2><p>681 个可读条目</p><div class="library-directory-toolbar">${directoryTools(ctx,true)}</div><footer><span>可读条目与卷组</span><button data-action="directory-locate-current">定位当前</button></footer></section><footer class="library-comic-directory-current"><span>当前章节</span><strong>06</strong><span>5 / 24 页</span></footer></section>`;}
function downloadManagementView(ctx){return `${comicDirectoryView(ctx)}<div class="library-comic-download-overlay"><button data-action="comic-download-close" aria-label="关闭下载菜单"></button><section class="library-comic-download-menu ${ctx.variant==='book-loading'?'loading':''}">${ctx.variant==='book-loading'?'<p>正在读取下载状态…</p>':'<button data-action="comic-download-all">下载全部章节</button><button data-action="comic-clear-cache">清除普通阅读缓存</button>'}</section></div>`;}
function multiselectView(ctx){
  const selected=ctx.variant==='selected'||ctx.screen==='book-removal';
  return `<section class="library-view library-multiselect-view" aria-label="批量管理"><header><button data-action="multiselect-cancel">取消</button><h1>已选择 ${selected?'1':'0'} 本</h1><button data-action="multiselect-all">全选</button></header><div class="library-scroll library-selection-list" data-scroll-key="library-multiselect">${books.map((book,index)=>`<button class="library-selection-row" data-action="multiselect-toggle:${book.id}"><span class="library-selection-cover">${cover(book)}<i class="${selected&&index===0?'checked':''}">${selected&&index===0?'✓':''}</i></span><span class="library-selection-meta"><span class="library-list-title"><strong>${esc(book.title)}</strong><span class="library-tags"><span>${book.kind}</span><span>在线</span></span></span><span class="library-list-author">${esc(book.author)}</span><span class="library-list-chapter">${esc(book.chapter)}</span><span class="library-list-progress-text"><span>最新：${esc(book.latest)}</span><span>已读 &lt;1%</span></span><span class="library-progress-track"><i style="width:${book.progress}%;min-width:3px"></i></span></span></button>`).join('')}</div><footer><button data-action="multiselect-remove" ${selected?'':'disabled'}>${icon('bookshelf_multiselect_trash',22)}<span>移除书架</span></button></footer></section>`;
}
function bookRemovalView(ctx){return `${multiselectView(ctx)}<div class="library-removal-overlay"><section class="library-removal-dialog" role="dialog" aria-modal="true" aria-label="移除书架"><h2>移除书架</h2><p>确定将已选择的 1 本书移出书架吗？本地原始文件不受影响。</p><footer><button data-action="removal-cancel">取消</button><button data-action="confirm-remove">移除</button></footer></section></div>`;}
function localImportView(ctx){return `${shelfView({...ctx,screen:'local-import',variant:'selection'})}<div class="library-import-overlay"><section class="library-import-panel" role="dialog" aria-modal="true" aria-label="导入本地书籍"><h2>导入本地书籍</h2><div class="library-import-body"><button class="library-import-dropzone" data-action="import-select-file"><i>${icon('import_select_system',20)}</i><strong>从系统文件中选择</strong><span>支持多选 TXT、EPUB、MOBI、AZW3</span><span class="library-import-formats">${[['TXT','#2d4a3e'],['EPUB','#5a4a2a'],['MOBI','#7a5a38'],['AZW3','#6a4f7a']].map(([label,color])=>`<i style="background:${color}">${label}</i>`).join('')}</span></button><p>${icon('import_info',13)}<span>支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。</span></p></div><footer><button data-action="import-select-file">${icon('import_select_system',15)}选择文件</button><button data-action="import-close">${icon('import_cancel',13)}取消</button></footer></section></div>`;}
function libraryAction(action,ctx){
  if(action==='detail-back')return ctx.variant==='manga'?{statePatch:{'library-latest-reading':'manga','settings-bookshelf-mode':'list','library-filter-expanded':true},go:{screen:'bookshelf',variant:'list-comic-latest',push:false}}:{go:{screen:'search',variant:'results',push:false}};
  if(action==='comic-download-close')return {back:true,go:{screen:'directory',variant:'manga'}};
  if(action==='close-shelf-more'||action==='close-book-actions')return {back:true,go:{screen:'bookshelf',variant:comicLatest(ctx)?'list-comic-latest':'list-filter'}};
  if(action.startsWith('shelf-menu:')){const screen=action.slice(11);return {go:{screen,variant:screen==='local-import'?'selection':screen==='multiselect'?'default':undefined,push:false}};}
  if(action==='import-close')return {back:true,go:{screen:'bookshelf',variant:'list-filter'}};
  if(action==='removal-cancel')return {back:true,go:{screen:'multiselect',variant:'selected'}};
  if(action==='multiselect-cancel')return {statePatch:{'library-selected-book':null},back:true,go:{screen:'bookshelf',variant:'list-filter'}};
  if(action==='multiselect-toggle:novel')return {statePatch:{'library-selected-book':ctx.variant==='selected'?null:'novel'},go:{screen:'multiselect',variant:ctx.variant==='selected'?'default':'selected',push:false}};
  if(action==='multiselect-remove')return ctx.variant==='selected'?{go:{screen:'book-removal',variant:'batch'}}:{};
  if(action==='search-clear')return {statePatch:{'library-search-query':''},focusField:'library-search-query'};
  if(action==='search-submit'||action.startsWith('search-history:')){
    const query=action.startsWith('search-history:')?action.slice(15):String(ctx.state['library-search-query']??(ctx.variant==='initial'?'':'斗破苍穹'));
    if(!query.trim())return {};
    if(query.trim()==='斗破苍穹')return {statePatch:{'library-search-query':query},go:{screen:'search',variant:'searching'}};
    return {statePatch:{'library-search-query':query,'library-unverified-action':`搜索「${query}」的原生结果尚未取证`}};
  }
  if(action==='search-stop')return {go:{screen:'search',variant:'results'}};
  if(action==='search-result:0:stopped')return {go:{screen:'detail',variant:'online'}};
  if(action.startsWith('search-')||action.startsWith('detail-')||action.startsWith('directory-'))return {statePatch:{'library-unverified-action':`${action}：对应原生后续尚未取证`}};
  if(action==='read-novel')return {go:{screen:'reader',variant:'body'}};
  if(action==='read-manga')return {go:{screen:'manga-reader',variant:'body'}};
  if(action==='book-menu-novel')return {go:{screen:'book-actions',variant:'default'}};
  if(action==='view-list')return {statePatch:{'settings-bookshelf-mode':'list','library-filter-expanded':false},go:{screen:'bookshelf',variant:'list',push:false}};
  if(action==='view-cover')return {statePatch:{'settings-bookshelf-mode':'cover','library-filter-expanded':false},go:{screen:'bookshelf',variant:'cover',push:false}};
  if(action==='toggle-filter'){
    if((ctx.state['settings-bookshelf-mode']||(ctx.variant==='cover'?'cover':'list'))==='cover')return {statePatch:{'library-unverified-action':'封面模式展开筛选的原生状态尚未取证'}};
    const expanded=ctx.state['library-filter-expanded']??['list-filter','list-comic-latest'].includes(ctx.variant);
    return {statePatch:{'library-filter-expanded':!expanded},go:{screen:'bookshelf',variant:expanded?'list':'list-filter',push:false}};
  }
  if(action==='clear-filters')return {statePatch:{'library-filter-content':'all','library-filter-origin':'all'}};
  if(action.startsWith('filter:')){
    const [,key,value]=action.split(':');
    // The empty local projection has not been captured; do not invent its UI.
    if(key==='origin'&&value==='local')return {statePatch:{'library-unverified-action':'本地筛选无匹配状态尚未取证'}};
    return {statePatch:{[`library-filter-${key}`]:value}};
  }
  return {statePatch:{'library-unverified-action':action.startsWith('book-action:')?'原生书籍操作后续未响应，路线尚未取证':action}};
}
// Missing captures remain in the specification; they do not create pretend pages.
const pending = () => '';
const definitions = [
  ['bookshelf', '书架', '书架', ['cover', 'list', 'filter']],
  ['shelf-more', '书架更多', '书架', ['default']],
  ['book-actions', '书籍操作', '书架', ['default']],
  ['multiselect', '批量管理', '书架', ['default', 'selected']],
  ['book-removal', '移除确认', '书架', ['default', 'batch']],
  ['group-select', '编辑分组', '书架', ['default']],
  ['local-import', '本地导入', '书架', ['selection', 'picker', 'result']],
  ['search', '搜索书籍', '搜索与详情', ['initial', 'results']],
  ['detail', '书籍详情', '搜索与详情', ['local', 'online', 'manga']],
  ['directory', '详情独立目录', '搜索与详情', ['text', 'manga']],
  ['download-management', '下载管理', '搜索与详情', ['book', 'chapter']],
];

export const libraryScreens = definitions.map(([id, label, group, variantIds]) => ({
  id, label, group, category: null, classificationStatus:'pending', candidateCategory: 'existing-app', status: 'pending-native-capture',
  variants: variantIds.map(id => ({ id, label: id, category: null, classificationStatus:'pending', candidateCategory: 'existing-app', captureId: null, status: 'pending-native-capture' })),
  render: pending,
}));

Object.assign(libraryScreens.find(s=>s.id==='bookshelf'),{
  category:'existing-app',status:'native-observed',
  variants:[{id:'list-filter',label:'列表 · 筛选展开',category:'existing-app',captureId:shelfCapture,status:'native-observed'},{id:'list',label:'列表 · 筛选收起',category:'existing-app',captureId:'reader-control-redo-060-bookshelf-collapsed',status:'native-observed'},{id:'cover',label:'封面 · 筛选收起',category:'existing-app',captureId:'reader-control-redo-061-bookshelf-cover',status:'native-observed'},{id:'list-comic-latest',label:'列表 · 漫画最近阅读',category:'existing-app',captureId:'reader-control-redo-078-comic-detail-back',status:'native-observed'}],
  render:shelfView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='book-actions'),{
  category:'existing-app',status:'native-observed',
  variants:[{id:'default',label:'小说书籍操作',category:'existing-app',captureId:'reader-control-redo-035-book-actions',status:'native-observed'}],
  render:bookActionsView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='shelf-more'),{
  category:'existing-app',status:'native-observed',
  variants:[{id:'default',label:'书架锚定更多菜单',category:'existing-app',captureId:'reader-control-redo-038-bookshelf-more',status:'native-observed'}],
  render:shelfMoreView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='search'),{
  category:'existing-app',status:'native-observed',
  variants:[['initial','最近搜索 · 输入聚焦','050-library-search'],['searching','搜索进行中','051-library-search-results'],['results','搜索已停止','052-library-search-stopped']].map(([id,label,capture])=>({id,label,category:'existing-app',captureId:`reader-control-redo-${capture}`,status:'native-observed'})),render:searchView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='detail'),{
  category:'existing-app',status:'native-observed',variants:[{id:'online',label:'在线小说 · 已在书架',category:'existing-app',captureId:'reader-control-redo-053-book-detail-search',status:'native-observed'},{id:'local',label:'本地书 · 待取证',category:null,classificationStatus:'pending',candidateCategory:'existing-app',captureId:null},{id:'manga',label:'在线漫画 · 已在书架',category:'existing-app',captureId:'reader-control-redo-072-comic-detail',status:'native-observed'}],render:detailView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='directory'),{
  category:'existing-app',status:'native-observed',variants:[{id:'text',label:'小说独立完整目录',category:'existing-app',captureId:'reader-control-redo-054-detail-directory',status:'native-observed'},{id:'manga',label:'漫画独立完整目录',category:'existing-app',captureId:'reader-control-redo-073-comic-detail-directory',status:'native-observed'}],render:directoryView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='multiselect'),{
  category:'existing-app',status:'native-observed',variants:[['default','未选择','056-library-multiselect'],['selected','选中小说一本','057-library-selected']].map(([id,label,capture])=>({id,label,category:'existing-app',captureId:`reader-control-redo-${capture}`,status:'native-observed'})),render:multiselectView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='book-removal'),{
  category:'existing-app',status:'native-observed',variants:[{id:'batch',label:'批量移除 · 选择一本',category:'existing-app',captureId:'reader-control-redo-058-book-removal-confirm',status:'native-observed',visualComparisonStatus:'OPEN'}],render:bookRemovalView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='download-management'),{
  category:'existing-app',status:'native-observed',variants:[{id:'book-loading',label:'漫画整书菜单 · 读取状态',category:'existing-app',captureId:'reader-control-redo-074-comic-directory-more',status:'native-observed'},{id:'book-ready',label:'漫画整书菜单 · 已载入',category:'existing-app',captureId:'reader-control-redo-075-comic-directory-more-loaded',status:'native-observed'},{id:'chapter',label:'漫画单章菜单 · 待取证',category:null,classificationStatus:'pending',candidateCategory:'existing-app',captureId:null}],render:downloadManagementView,onAction:libraryAction,
});
Object.assign(libraryScreens.find(s=>s.id==='local-import'),{
  category:'existing-app',status:'native-observed',variants:[{id:'selection',label:'选择文件入口',category:'existing-app',captureId:'reader-control-redo-059-local-import',status:'native-observed'},{id:'picker',label:'文件选择 · 待取证',category:null,classificationStatus:'pending',candidateCategory:'existing-app',captureId:null},{id:'result',label:'导入结果 · 待取证',category:null,classificationStatus:'pending',candidateCategory:'existing-app',captureId:null}],render:localImportView,onAction:libraryAction,
});

for(const screen of libraryScreens){
  if(screen.status!=='native-observed')continue;
  const render=screen.render,action=screen.onAction;
  const normalize=ctx=>({...ctx,screen:typeof ctx.screen==='string'?ctx.screen:ctx.screen.id,variant:typeof ctx.variant==='string'?ctx.variant:ctx.variant.id});
  screen.render=ctx=>render(normalize(ctx));
  if(action)screen.onAction=(value,ctx)=>action(value,normalize(ctx));
}

export const libraryPending = definitions.filter(([id])=>!['bookshelf','book-actions','shelf-more','search','detail','directory','multiselect','book-removal','local-import','download-management'].includes(id)).map(([id, label]) => ({ id, label, reason: '当前 VM 实景尚未捕获，不能作为 UI 开发基准。' }));
