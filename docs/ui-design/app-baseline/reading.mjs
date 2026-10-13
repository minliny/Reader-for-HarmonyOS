import { esc, icon, button, slider, field, toggle } from './shared.mjs';

const nativeRoot = '../../../evidence/2026-10-06-native-ui-redo/captures/';
const nativeManga = `${nativeRoot}reader-control-redo-062-comic-entry.png`;

function mangaArt(controls) {
  return `<div class="reading-manga-art ${controls ? 'with-controls' : ''}"><img src="${nativeManga}" alt="斗破苍穹，第 06 话，第 5 页实景内容"></div>`;
}

function mangaControlView(ctx) {
  const controls = ctx.variant.id === 'controls';
  return `<section class="reading-stage reading-manga-stage ${controls ? 'reading-controls-visible' : ''}" aria-label="漫画阅读">${mangaArt(controls)}
    <button class="reading-body-touch" data-go="manga-reader" data-variant="${controls ? 'body' : 'controls'}" aria-label="${controls ? '关闭' : '显示'}漫画阅读控制"></button>
    ${controls ? `<div class="reading-top-card">
      <div class="reading-top-leading">${button('', {action:'exit-manga',icon:'book_detail_back',kind:'icon',className:'reading-top-icon'})}</div>
      <div class="reading-top-book"><strong>斗破苍穹</strong><span>06</span></div>
      <div class="reading-top-trailing">${button('换源', {action:'manga-source-unverified',icon:'reader_directory_switch',kind:'icon-label',className:'reading-source-button'})}${button('', {go:'manga-more',variant:'sheet',icon:'reader_directory_more',kind:'icon',className:'reading-top-icon',})}</div>
    </div>
    <div class="reading-manga-dock">
      <div class="reading-page-controls">
        <div class="reading-page-center"><div class="reading-native-range" aria-label="第 5 页，共 24 页">${slider('', 5, 'reading-manga-page', {min:1,max:24,step:1})}</div><div class="reading-page-count">5 / 24 页</div></div>
      </div>
      <nav class="reading-manga-actions" aria-label="漫画阅读工具">
        ${button('目录',{go:'manga-directory',icon:'reader_directory_directory',kind:'icon-label'})}
        ${button('阅读方式',{go:'manga-mode',icon:'reader_appearance_header',kind:'icon-label'})}
        ${button('设置',{go:'manga-settings',icon:'reader_settings_header',kind:'icon-label'})}
      </nav>
    </div>` : '<div class="reading-standing-page">5 / 24</div>'}
  </section>`;
}

export function mangaPanelShell(ctx,{title,inner,initialScroll=0,height=405.143,scrollKey='reading-manga-panel-scroll',novelTarget=false}={}) {
  const origin=novelTarget?'reader-controls':'manga-reader';
  const originVariant=novelTarget?'home':'controls';
  const backdrop=novelTarget?novelControls(ctx):mangaControlView({...ctx,variant:{id:'controls'}});
  const overlay=`<button class="reading-manga-sheet-scrim" data-go="${origin}" data-variant="${originVariant}" aria-label="关闭${esc(title)}"></button><section class="reading-manga-sheet" aria-label="${esc(title)}" style="--reading-sheet-height:${height}px"><button class="reading-manga-sheet-grabber" data-go="${origin}" data-variant="${originVariant}" aria-label="收起面板"><i></i></button><h2>${esc(title)}</h2>${button('',{go:origin,variant:originVariant,icon:'manga_sheet_close',kind:'icon',className:'reading-manga-sheet-close'})}<div class="reading-manga-sheet-scroll" data-scroll-key="${esc(scrollKey)}" data-initial-scroll="${initialScroll}">${inner}</div></section>`;
  return backdrop.replace(/<\/section>$/,overlay+'</section>');
}

const mangaMoreItems=[
  ['更换书源','manga-source-unverified'],['重新打开本话','manga-refresh'],['漫画详情','manga-detail'],['下载本话','manga-download-chapter'],['下载全部章节','manga-download-book'],['下载管理','manga-download-manager'],['移出书架','manga-remove-shelf'],
];
function mangaMoreView(ctx) {
  const inner=`<div class="reading-manga-menu">${mangaMoreItems.map(([label,action])=>button(label,{action,className:'reading-manga-menu-item'})).join('')}</div>`;
  return mangaPanelShell(ctx,{title:'更多',inner,initialScroll:ctx.variant.id==='lower'?173.143:0,scrollKey:'reading-manga-more-scroll'});
}

function mangaMoreAction(action) {
  if(action==='manga-download-manager')return {go:{screen:'manga-downloads',variant:'book-actions'}};
  if(action==='manga-detail')return {go:{screen:'detail',variant:'manga'}};
  return unobservedAction(action);
}

function mangaDownloadsView(ctx) {
  const loading=ctx.variant.id==='loading';
  const inner=loading?'<div class="reading-manga-download-loading">正在读取下载状态…</div>':`<div class="reading-manga-download-actions">${button('下载全部章节',{action:'manga-download-all',className:'reading-manga-menu-item'})}${button('清除普通阅读缓存',{action:'manga-clear-reading-cache',className:'reading-manga-menu-item'})}</div>`;
  return mangaPanelShell(ctx,{title:'本书下载',inner,height:288,scrollKey:'reading-manga-download-scroll'});
}

function mangaDirectoryView(ctx) {
  const inner=`<div class="reading-manga-directory"><label class="reading-manga-directory-query">${icon('manga_sheet_search',17)}<input data-field="reading-manga-directory-query" value="${esc(ctx.state['reading-manga-directory-query']??'')}" placeholder="搜索章名或序号" aria-label="搜索章名或序号"></label><div class="reading-manga-directory-tools">${button('定位当前条目',{action:'manga-directory-locate',icon:'manga_sheet_locate',kind:'text'})}${button('正序',{action:'manga-directory-sort',icon:'manga_sheet_vertical_accent',kind:'text'})}</div><div class="reading-manga-directory-list" data-scroll-key="reading-manga-directory-list" data-initial-scroll="36.857">${['05','06','07','08'].map(title=>`<div class="reading-manga-directory-row ${title==='06'?'current':''}"><button class="reading-manga-directory-chapter" data-action="manga-chapter-${title}">${title}</button>${button('',{action:`manga-chapter-download-${title}`,icon:'reader_directory_marker_download',kind:'icon',className:'reading-manga-directory-download'})}${title==='06'?'<span class="reading-manga-directory-current">正在读</span>':button('',{action:`manga-chapter-${title}`,icon:'manga_sheet_chevron_right',kind:'icon',className:'reading-manga-directory-open'})}</div>`).join('')}<div class="reading-manga-directory-unobserved-tail" aria-hidden="true"></div></div></div>`;
  return mangaPanelShell(ctx,{title:'章节目录',inner,height:585.714,scrollKey:'reading-manga-directory-shell-scroll'});
}

function mangaChoice(label,asset,selected,action) {
  return `<button class="reading-manga-choice ${selected?'selected':''}" data-action="${esc(action)}" aria-pressed="${selected}">${icon(asset,18)}<span>${esc(label)}</span></button>`;
}

function mangaModeView(ctx) {
  const inner=`<div class="reading-manga-preferences"><section><h3>阅读模式</h3><div class="reading-manga-choices">${mangaChoice('竖向连续','manga_sheet_vertical_active',true,'manga-mode-vertical')}${mangaChoice('横向分页','manga_sheet_horizontal',false,'manga-mode-horizontal')}</div></section><section><h3>图片适配</h3><div class="reading-manga-fit-options">${[['跟随书源','source'],['适合屏幕','width'],['完整图片','contain']].map(([label,value])=>`<button data-action="manga-fit-${value}"><span>${label}</span>${value==='source'?icon('manga_sheet_check',18):''}</button>`).join('')}</div></section></div>`;
  return mangaPanelShell(ctx,{title:'阅读方式',inner,height:393.143,scrollKey:'reading-manga-mode-scroll'});
}

function mangaSettingsView(ctx) {
  const brightness=Number(ctx.state['reading-manga-brightness']??50);
  const pageNumbers=ctx.state['reading-manga-page-numbers']??true;
  const inner=`<div class="reading-manga-preferences reading-manga-preferences-settings"><section><h3>阅读底色</h3><div class="reading-manga-choices">${mangaChoice('暖纸','manga_sheet_sun_active',true,'manga-paper-warm')}${mangaChoice('深墨','manga_sheet_moon',false,'manga-paper-ink')}</div></section><section><h3 class="reading-manga-brightness-heading"><span>亮度</span><small>${brightness}%</small></h3><div class="reading-manga-brightness-slider">${slider('',brightness,'reading-manga-brightness',{min:20,max:100,step:1})}</div><div class="reading-manga-page-number-option">${toggle('常驻页码',pageNumbers,'reading-manga-page-numbers')}</div></section>${button('恢复默认',{action:'manga-reset-preferences',kind:'text',className:'reading-manga-reset'})}</div>`;
  return mangaPanelShell(ctx,{title:'漫画阅读设置',inner,height:383.143,scrollKey:'reading-manga-settings-scroll'});
}

function novelMoreTarget(ctx) {
  const inner=`<div class="reading-manga-menu">${[['书籍信息','novel-book-info'],['刷新本章','novel-refresh'],['下载全部章节','novel-download-all']].map(([label,action])=>button(label,{action,className:'reading-manga-menu-item'})).join('')}</div>`;
  return mangaPanelShell(ctx,{title:'更多',inner,height:314,scrollKey:'reading-novel-more-target-scroll',novelTarget:true});
}

function novelBody() {
  const lines = [
    '儿小嘴泛起了柔和的笑意，目光转移到',
    '书籍之上，口中似乎是自喃般的淡淡',
    '道：“虽然知道他是好意，可熏儿不管',
    '怎么说也是女孩子吧？哪有偷偷摸女孩',
    '子身体的道理，若是熏儿寻出了那人，',
    '哼…”',
  ];
  return `<section class="reading-stage reading-novel-body" aria-label="小说正文">
    <header class="reading-text-running"><span>斗破苍穹</span><span>00:20</span></header>
    <div class="reading-text-page" lang="zh-CN"><p>${lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p>
    <p class="reading-text-last"><span>嘴角裂了裂，萧炎心头有些心虚，</span><span>眼观鼻，鼻观心，不言不语…</span></p></div>
    <footer class="reading-text-progress">0%</footer>
    <button class="reading-body-touch" data-go="reader-controls" aria-label="显示小说阅读控制"></button>
  </section>`;
}

function novelControlBackdrop() {
  return `<div class="reading-control-text" aria-hidden="true"><p>炎哥哥，你说，他会是谁？”熏儿沉默<br>了半晌，忽然的偏过头，对着萧炎嫣然<br>一笑，少女独有的风情，让得周围的少<br>年眼睛有些放光。</p><p>“咳…我，我怎么知道？那么小，<br>我们都还在地上爬呢，我哪知道。”心<br>头猛的一跳，萧炎讪笑了两声，旋即有<br>些心虚的将目光转向大厅内。</p><p>“嘻嘻…”望着萧炎的反应，萧熏<br>儿小嘴泛起了柔和的笑意，目光转移到</p></div>`;
}

function novelTop() {
  return `<header class="reading-novel-top">${button('',{action:'exit-novel',icon:'rc_arrow_left',kind:'icon',className:'reading-novel-back'})}<div class="reading-novel-book"><strong>斗破苍穹</strong><span>第三章 客人 · 阅读助手（优+++）</span></div>${button('换源',{go:'source-switch',icon:'rc_switch_horizontal',kind:'icon-label',className:'reading-novel-source'})}${button('',{go:'reader-more',icon:'rc_dots',kind:'icon',className:'reading-novel-more'})}</header>`;
}

function novelNav(active='') {
  return `<nav class="reading-novel-nav" aria-label="阅读模块">${[
    ['directory','目录','rc_list'],['tts','朗读','rc_headphones'],['appearance','界面','rc_palette'],['settings','设置','rc_settings']
  ].map(([id,label,asset])=>`<button data-go="${active===id?'reader-controls':`reader-${id}`}" class="${active===id?'selected':''}"><i>${icon(asset,24)}</i><span>${label}</span></button>`).join('')}</nav>`;
}

function novelBrightness() {
  return `<aside class="reading-brightness" aria-label="阅读亮度">${icon('rc_sun',20)}<div class="reading-brightness-track"><i></i></div><button data-action="brightness-auto" aria-label="自动亮度">A</button></aside>`;
}

export function novelControlShell(inner,{full=false,title='',titleIcon='',active='',variant='',screen='reader-controls',temporary=false}={}) {
  return `<section class="reading-stage reading-novel-control-stage">${novelControlBackdrop()}<button class="reading-body-touch" data-go="reader" data-variant="body" aria-label="关闭阅读控制"></button>${novelTop()}<div class="reading-novel-shell ${full?'full':''} ${temporary?'temporary':''}">
    <button class="reading-novel-grabber" data-action="${full?'collapse':'expand'}" aria-label="${full?'收起':'展开'}控制面板"><i></i></button>
    ${full?`<header class="reading-module-header">${icon(titleIcon,16)}<strong>${esc(title)}</strong>${button(screen==='reader-replace'?'完成':'收起',{go:screen,variant:'quick',kind:'text'})}</header>`:''}
    <div class="reading-novel-content ${full?'full':''}">${inner}</div>
    ${full?'':novelBrightness()+novelNav(active)}
  </div></section>`;
}

function novelControls(ctx) {
  return novelControlShell(`<div class="reading-home-chapter"><div class="reading-home-chapter-name">${button('',{action:'chapter-previous',icon:'rc_chevron_left',kind:'icon'})}<strong>第三章 客人</strong>${button('',{action:'chapter-next',icon:'rc_chevron_right',kind:'icon'})}</div><div class="reading-home-progress"><span>0%</span>${slider('',0.174831,'reading-chapter-progress',{min:0,max:100})}<span>共 1663</span></div></div><div class="reading-home-quick-actions">${[['search','搜索','rc_search'],['autopage','自动翻页','rc_autopage'],['replace','替换','rc_replace']].map(([id,label,asset])=>button(label,{go:`reader-${id}`,variant:'quick',icon:asset,kind:'icon-label'})).join('')}</div>`);
}

function replaceControl(ctx) {
  const full = !['quick','quick-preview'].includes(ctx.variant.id);
  if(ctx.variant.id==='quick-preview')return novelControlShell(`<section class="reading-replace-quick reading-replace-quick-preview" aria-label="快捷替换预览"><h2 class="reading-replace-overlapping-title">替换规则管理</h2>${replacePreview(ctx)}</section>`,{screen:'reader-replace',variant:'quick-preview',temporary:true});
  if (!full) return novelControlShell(`<section class="reading-replace-quick" aria-label="替换规则管理">${button('返回',{go:'reader-controls',variant:'home',icon:'reader_control_replace_back',kind:'text',className:'reading-replace-back'})}<h2>替换规则管理</h2><div class="reading-replace-empty">暂无替换规则，可展开后新增</div><footer>${button('预览效果',{action:'replace-preview',kind:'text'})}${button('完整管理',{action:'replace-expand',kind:'text'})}</footer></section>`,{screen:'reader-replace',variant:'quick'});
  let inner;
  const temporary = ['editor','editor-options','preview'].includes(ctx.variant.id);
  if (ctx.variant.id === 'editor' || ctx.variant.id === 'editor-options') inner = replaceEditor(ctx);
  else if (ctx.variant.id === 'preview') inner = replacePreview(ctx);
  else inner = `<section class="reading-replace-full"><nav class="reading-replace-toolbar">${button('新增规则',{action:'replace-new',icon:'reader_control_replace_add',kind:'primary'})}${button('导入',{action:'replace-import',icon:'reader_control_replace_import'})}${button('导出',{action:'replace-export',icon:'reader_control_replace_export'})}</nav><div class="reading-replace-list"><div class="reading-replace-full-empty">暂无替换规则，点击上方“新增规则”</div>${button('预览当前章节已保存规则',{action:'replace-preview',kind:'text',className:'reading-replace-preview-button'})}</div></section>`;
  return novelControlShell(inner,{full,title:'替换规则管理',titleIcon:'reader_control_replace_header',screen:'reader-replace',temporary});
}

const replaceDraftDefaults = {
  name:'',pattern:'',replacement:'',group:'',scope:'斗破苍穹;https://api-bc.wtzw.com',exclude:'',order:'0',timeout:'3000',
  enabled:true,regex:true,title:false,content:true,source:false,
};

function replaceEditor(ctx) {
  const textFields = [['名称','name'],['匹配内容','pattern'],['替换为（可留空）','replacement'],['分组','group'],['包含书名／书源范围（留空为全部）','scope'],['排除范围','exclude'],['排序（整数）','order'],['执行超时（毫秒）','timeout']];
  const flags = [['启用规则','enabled'],['正则表达式','regex'],['作用于标题','title'],['作用于正文','content'],['作用于书源导入','source']];
  const value = key=>ctx.state[`reading-replace-${key}`]??replaceDraftDefaults[key];
  return `<section class="reading-replace-temporary reading-replace-editor"><header>${button('返回',{action:'replace-cancel-layer',kind:'text'})}<strong>新增替换规则</strong></header><div class="reading-replace-scroll" data-scroll-key="reading-replace-editor-scroll" data-initial-scroll="${ctx.variant.id==='editor-options'?213:0}"><div class="reading-replace-fields">${textFields.map(([label,key])=>field(label,value(key),`reading-replace-${key}`)).join('')}${flags.map(([label,key])=>toggle(label,!!value(key),`reading-replace-${key}`)).join('')}<p>保存后规则生效；章节预览使用已保存规则。</p></div></div><footer>${button('取消',{action:'replace-cancel-layer'})}${button('保存',{action:'replace-save',kind:'primary'})}</footer></section>`;
}

const previewSample = '床榻之上，少年闭目盘腿而坐，双手在身前摆出奇异的手印，胸膛轻微起伏，一呼一吸间，形成完美的循环，而在气息循环间，有着淡淡的白色气流顺着口鼻，钻入了体内，温养着骨骼与肉体。\n在少年闭目修炼之时，手指上那古朴的黑色戒指，再次诡异的微微发光，旋即沉寂…\n“呼…”缓缓的吐出一口浊气，少年双眼乍然睁开，一抹淡淡的白芒在漆黑的眼中';
function replacePreview(ctx) {
  return `<section class="reading-replace-temporary reading-replace-preview"><header><strong>当前章节预览</strong>${button('取消',{action:'replace-cancel-layer',kind:'text'})}</header><div class="reading-replace-scroll" data-scroll-key="reading-replace-preview-scroll"><div class="reading-replace-preview-content"><p class="reading-preview-chapter">第三章 客人</p><p class="reading-preview-count">已保存 0 条，启用 0 条；仅展示截取片段</p><h3>替换前</h3><p class="reading-preview-text">${esc(previewSample)}</p><h3>替换后</h3><p class="reading-preview-text">${esc(previewSample)}</p></div></div></section>`;
}

function replaceAction(action,ctx) {
  if(action==='expand'&&ctx.variant.id==='quick-preview')return unobservedAction('replace-preview-expand');
  if(action==='replace-expand'||action==='expand')return {go:{screen:'reader-replace',variant:'full'}};
  if(action==='collapse')return {go:{screen:'reader-replace',variant:'quick'}};
  if(action==='replace-new')return {go:{screen:'reader-replace',variant:'editor'},statePatch:Object.fromEntries(Object.entries(replaceDraftDefaults).map(([key,value])=>[`reading-replace-${key}`,value]))};
  if(action==='replace-preview') {
    // The native preview keeps the current actor height: capture080 is Quick,
    // while capture009 is Full. Opening preview never implies expansion.
    if(ctx.variant.id==='quick')return {go:{screen:'reader-replace',variant:'quick-preview'},statePatch:{'reading-replace-layer-origin':'quick'}};
    return {go:{screen:'reader-replace',variant:'preview'},statePatch:{'reading-replace-layer-origin':'full'}};
  }
  if(action==='replace-cancel-layer')return {go:{screen:'reader-replace',variant:ctx.variant.id==='quick-preview'?'quick':'full'}};
  return unobservedAction(action);
}

const capturedDirectoryTitles = ['第一章 陨落的天才','第二章 斗气大陆','第三章 客人','第四章 云岚宗','第五章 聚气散','第六章 炼药师','第七章休！','第八章 神秘的老者','第九章 药老！','第十章 借钱','第十一章 坊市','第十二章 离他远点'];

function directoryView(ctx) {
  const full = ctx.variant.id === 'full';
  const bookmarks = ctx.screen.id === 'reader-bookmarks';
  const query = ctx.state['reading-directory-query']??'';
  let rows = capturedDirectoryTitles.map((title,index)=>({title,index}));
  if(ctx.state['reading-directory-search-applied'])rows=rows.filter(row=>row.title.includes(query));
  if(ctx.state['reading-directory-sort']==='descending')rows=rows.slice().reverse();
  const inner = `<section class="reading-directory ${full?'full':''} ${bookmarks?'bookmarks':''}"><nav class="reading-directory-tabs"><button data-go="reader-directory" data-variant="${full?'full':'quick'}" class="${bookmarks?'':'selected'}">${icon('reader_directory_list_active',12)}<span>章节</span></button><button data-go="reader-bookmarks" data-variant="${full?'full':'quick'}" class="${bookmarks?'selected':''}">${icon('reader_directory_marker_bookmark',12)}<span>书签</span></button></nav>
    ${full?`<div class="reading-directory-tools"><label>${icon('reader_directory_input_search',17)}<input data-field="reading-directory-query" value="${esc(query)}" placeholder="${bookmarks?'搜索书签内容':'搜索章节名称'}"></label>${button('',{action:'directory-search',icon:'reader_directory_search',kind:'icon'})}${bookmarks?'':button('',{action:'directory-top',icon:'reader_directory_top',kind:'icon'})+button('',{action:'directory-bottom',icon:'reader_directory_bottom',kind:'icon'})+button('',{action:'directory-sort',icon:'reader_directory_sort_ascending',kind:'icon'})}</div>`:''}
    <div class="reading-directory-list" data-scroll-key="reading-directory-list">
    ${bookmarks?`<div class="reading-bookmark-loading"><i></i><span>书签载入中…</span></div>`:rows.map(row=>`<button class="reading-directory-row ${row.index===2?'current':''}" data-action="directory-select-${row.index}">${esc(row.title)}</button>`).join('')}
    </div>
    ${full&&!bookmarks?`<footer><span>当前章节</span><strong>第三章 客人</strong><span>3 / 1663</span></footer>`:''}
  </section>`;
  return novelControlShell(inner,{full,title:bookmarks?'书签':'目录',titleIcon:bookmarks?'reader_directory_marker_bookmark':'rc_list',active:'directory',screen:ctx.screen.id});
}

function directoryAction(action,ctx) {
  if(action==='expand')return {go:{screen:ctx.screen.id,variant:'full'}};
  if(action==='collapse')return {go:{screen:ctx.screen.id,variant:'quick'}};
  // Controls exist in native captures; result states below are inferred only
  // from source and remain visibly unaccepted in the external evidence panel.
  if(action==='directory-search'||action==='directory-sort')return unobservedAction(action);
  return unobservedAction(action);
}

const capturedSearchSnippets = [
  '一抹自嘲，紧握的手掌，因为大力，而导致略微尖锐的指甲深深的刺进了掌心之中，带来一阵阵钻心的疼痛…\n“萧炎，斗之气，三段！级别：低级！”测验魔石碑之旁，一位中年男子，看了一眼碑上所显示出来的信息，语气漠然的',
  '利吗？或许是因为三年前他们曾经在自己面前露出过最谦卑的笑容，所以，如今想要讨还回去吧…”苦涩的一笑，萧炎落寞的转身，安静的回到了队伍的最后一排，孤单的身影，与周围的世界，有些格格不入。\n“下一个，萧媚！”',
  '那一道孤单身影上…\n皱眉思虑了瞬间，萧媚还是打消了过去的念头，现在的两人，已经不在同一个阶层之上，以萧炎最近几年的表现，成年后，顶多只能作为家族中的下层人员，而天赋优秀的她，则将会成为家族重点培养的强者，',
  '岁年龄成为一名真正的斗者，你是萧家百年内的第二人！”\n是的，第二人，那位第一人，便是褪去了天才光环的萧炎。\n“谢谢。”少女微微点了点头，平淡的小脸并未因为他的夸奖而出现喜悦，安静的回转过身，然后在众人炽热',
  '夸奖而出现喜悦，安静的回转过身，然后在众人炽热的注目中，缓缓的行到了人群最后面的那颓废少年面前…\n“萧炎哥哥。”在经过少年身旁时，少女顿下了脚步，对着萧炎恭敬的弯了弯腰，美丽的俏脸上，居然露出了让周围少女',
  '目中，缓缓的行到了人群最后面的那颓废少年面前…\n“萧炎哥哥。”在经过少年身旁时，少女顿下了脚步，对着萧炎恭敬的弯了弯腰，美丽的俏脸上，居然露出了让周围少女为之嫉妒的清雅笑容。\n“我现在还有资格让你这么叫么',
  '少女为之嫉妒的清雅笑容。\n“我现在还有资格让你这么叫么?”望着面前这颗已经成长为家族中最璀璨的明珠，萧炎苦涩的道，她是在自己落魄后，极为少数还对自己依旧保持着尊敬的人。\n“萧炎哥哥，以前你曾经与薰儿说过，',
  '经成长为家族中最璀璨的明珠，萧炎苦涩的道，她是在自己落魄后，极为少数还对自己依旧保持着尊敬的人。\n“萧炎哥哥，以前你曾经与薰儿说过，要能放下，才能拿起，提放自如，是自在人！”萧薰儿微笑着柔声道，略微稚嫩的',
];

function searchSnippet(text) {
  const index=text.indexOf('萧炎');
  return index<0?esc(text):`${esc(text.slice(0,index))}<mark>萧炎</mark>${esc(text.slice(index+2))}`;
}

function searchView(ctx) {
  const full=ctx.variant.id!=='quick';
  const results=ctx.variant.id==='results';
  const keyboard=ctx.variant.id==='keyboard';
  const query=ctx.state['reading-search-query']??((results||keyboard)?'萧炎':'');
  const inner=`<section class="reading-search ${full?'full':''}" aria-label="内容搜索"><div class="reading-search-tools">${full?'':button('返回',{go:'reader-controls',icon:'reader_quick_back',kind:'text',className:'reading-search-back'})}<input data-field="reading-search-query" value="${esc(query)}" placeholder="搜索正文内容" aria-label="搜索正文内容">${button('',{action:'search-submit',icon:'reader_directory_search',kind:'icon',disabled:!query.trim()})}</div><div class="reading-search-results" data-scroll-key="reading-search-results">${results?capturedSearchSnippets.map((text,i)=>`<button class="reading-search-result" data-action="search-select-${i}"><strong>第一章 陨落的天才</strong><span>${searchSnippet(text)}</span></button>`).join(''):'<div class="reading-search-empty">输入关键词搜索正文内容</div>'}</div>${results?button('加载更多结果',{action:'search-load-more',kind:'text',className:'reading-search-load-more'}):''}</section>`;
  const html=novelControlShell(inner,{full,title:'内容搜索',titleIcon:'rc_search',screen:'reader-search'});
  return keyboard?html.replace('reading-novel-control-stage','reading-novel-control-stage reading-keyboard-obstructed'):html;
}

function searchAction(action,ctx) {
  if(action==='expand')return {go:{screen:'reader-search',variant:'full'}};
  if(action==='collapse')return {go:{screen:'reader-search',variant:'quick'}};
  if(action==='search-submit') {
    const query=(ctx.state['reading-search-query']??(ctx.variant.id==='keyboard'||ctx.variant.id==='results'?'萧炎':'')).trim();
    if(query==='萧炎'&&ctx.variant.id!=='quick')return {go:{screen:'reader-search',variant:'results'},statePatch:{'reading-search-query':query}};
  }
  return unobservedAction(action);
}

function autoPageTransport(full) {
  return `<div class="reading-auto-transport"><button data-action="autopage-previous"><i class="double-chevron">${icon('reader_auto_full_chevron_left',16)}${icon('reader_auto_full_chevron_left',16)}</i><span>上一章</span></button><button class="start" data-action="autopage-start"><i>${icon('reader_auto_full_play',22)}</i>${full?'<span>自动翻页</span>':''}</button><button class="stop" data-action="autopage-stop" disabled><i>${icon('reader_auto_full_stop',17)}</i><span>停止</span></button><button data-action="autopage-next"><i class="double-chevron">${icon('reader_auto_full_chevron_right',16)}${icon('reader_auto_full_chevron_right',16)}</i><span>下一章</span></button></div>`;
}

function timerWheel(value,key,max,unit) {
  const pad=n=>String(n).padStart(unit==='秒'?2:1,'0');
  return `<div class="reading-timer-wheel"><button data-action="${key}-decrease" ${value===0?'disabled':''}>${value>0?pad(value-1):''}</button><strong>${pad(value)}</strong><button data-action="${key}-increase" ${value===max?'disabled':''}>${value<max?pad(value+1):''}</button><span>${unit}</span></div>`;
}

function autoPageView(ctx) {
  const full=ctx.variant.id==='full';
  const speed=Number(ctx.state['reading-autopage-speed']??8);
  const minutes=Number(ctx.state['reading-autopage-minutes']??15),seconds=Number(ctx.state['reading-autopage-seconds']??0);
  const inner=`<section class="reading-autopage ${full?'full':''}" aria-label="自动翻页">${full?'':'<header><strong>自动翻页</strong><span>未开始</span></header>'}<div class="reading-auto-control">${full?'<header><strong>自动翻页控制</strong><span>未开始</span></header>':''}${autoPageTransport(full)}</div>${full?`<section class="reading-auto-timer"><header><strong>定时</strong><span>${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</span></header><div class="reading-auto-timer-body"><label>${icon('reader_auto_full_clock',18)}<strong>自动停止</strong></label><div class="reading-auto-wheels">${timerWheel(minutes,'autopage-minutes',180,'分')}<b>:</b>${timerWheel(seconds,'autopage-seconds',59,'秒')}</div></div></section><header class="reading-auto-details"><strong>详细配置</strong><span>即时生效</span></header>`:''}<div class="reading-auto-speed"><strong>翻页速度</strong>${full?`<span>${speed} 秒</span><small>2 秒</small>${slider('',speed,'reading-autopage-speed',{min:2,max:20,step:1})}<small>20 秒</small>`:`<button data-action="autopage-speed-decrease" ${speed<=2?'disabled':''}>−</button><span>${speed} 秒</span><button data-action="autopage-speed-increase" ${speed>=20?'disabled':''}>+</button>`}</div>${full?`<div class="reading-auto-follow">${toggle('跟随高亮',!!ctx.state['reading-autopage-follow'],'reading-autopage-follow')}</div>`:''}</section>`;
  return novelControlShell(inner,{full,title:'自动翻页',titleIcon:'rc_autopage',screen:'reader-autopage'});
}

function autoPageAction(action,ctx) {
  if(action==='expand')return {go:{screen:'reader-autopage',variant:'full'}};
  if(action==='collapse')return {go:{screen:'reader-autopage',variant:'quick'}};
  const match=/^autopage-(speed|minutes|seconds)-(increase|decrease)$/.exec(action);
  if(match) {
    const key=`reading-autopage-${match[1]}`,defaults={speed:8,minutes:15,seconds:0},limits={speed:[2,20],minutes:[0,180],seconds:[0,59]};
    const [min,max]=limits[match[1]],value=Math.max(min,Math.min(max,Number(ctx.state[key]??defaults[match[1]])+(match[2]==='increase'?1:-1)));
    return {statePatch:{[key]:value}};
  }
  return unobservedAction(action);
}

function ttsPlayButton(full) {
  return `<button class="reading-tts-play" data-action="tts-play" aria-label="开始朗读">${icon('reader_tts_make_play',full?20:13)}</button>`;
}
function ttsRate(ctx,full) {
  const rate=Number(ctx.state['reading-tts-rate']??1);
  return full?`<section class="reading-tts-rate"><header><strong>语速</strong><span>${rate.toFixed(2)}x</span></header><div class="reading-tts-card"><div class="reading-tts-rate-range">${slider('',rate,'reading-tts-rate',{min:.5,max:2,step:.05})}</div><div class="reading-tts-rate-extents"><span>0.50x</span><span>2.00x</span></div><nav>${[.5,.75,1,1.25,1.5].map(n=>`<button class="${rate===n?'selected':''}" data-set="reading-tts-rate" data-value="${n}">${n.toFixed(2)}x</button>`).join('')}</nav></div></section>`:`<div class="reading-tts-quick-rate"><i>${icon('reader_tts_rate',17)}</i><strong>语速</strong><div>${slider('',rate,'reading-tts-rate',{min:.5,max:2,step:.05})}</div><span>${rate.toFixed(2)}x</span></div>`;
}
function ttsTimer(ctx) {
  const minutes=Number(ctx.state['reading-tts-minutes']??25),seconds=Number(ctx.state['reading-tts-seconds']??0),mode=ctx.state['reading-tts-timer-mode']??'duration';
  const summary=mode==='chapterEnd'?'本章结束':mode==='off'?'不开启':`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  const selected=n=>n==='chapterEnd'?mode==='chapterEnd':n===0?mode==='off':mode==='duration'&&minutes===n&&seconds===0;
  const stepper=(key,value,max)=>`<div class="reading-tts-stepper"><button data-action="tts-${key}-decrease" ${value<=0?'disabled':''}>${icon('reader_tts_make_minus',12)}</button><strong>${String(value).padStart(2,'0')}</strong><button data-action="tts-${key}-increase" ${value>=max?'disabled':''}>${icon('reader_tts_make_plus',12)}</button></div>`;
  return `<section class="reading-tts-timer"><header><strong>定时停止</strong><span>${icon('reader_tts_clock',13)}${summary}</span></header><div class="reading-tts-card"><nav>${[0,15,30,45,60,'chapterEnd'].map(n=>`<button class="${selected(n)?'selected':''}" data-action="tts-timer-${n}">${n==='chapterEnd'?'本章结束':n===0?'不开启':`${n} 分钟`}</button>`).join('')}</nav><div class="reading-tts-custom-time"><label><strong>自定义时长</strong><span>分 · 秒</span></label>${stepper('minutes',minutes,180)}${stepper('seconds',seconds,59)}</div></div></section>`;
}
function ttsEngine() {
  return `<section class="reading-tts-engine"><header><strong>朗读引擎</strong></header><div class="reading-tts-card"><nav><button class="selected" data-action="tts-system-engine"><div>${icon('reader_tts_system_engine',20)}${icon('reader_tts_make_engine_check',16)}</div><strong>系统 TTS</strong><span>设备内置语音</span></button><button data-action="tts-online-engine"><div>${icon('reader_tts_online_engine',20)}</div><strong>在线 TTS</strong><span>第三方语音服务</span></button></nav><button class="reading-tts-config-row" data-action="tts-engine-options"><span>语音引擎</span><strong>系统默认</strong>${icon('reader_appearance_make_chevron',12)}</button><button class="reading-tts-config-row" data-action="tts-language-options"><span>朗读语言</span><strong>普通话</strong>${icon('reader_appearance_make_chevron',12)}</button></div></section>`;
}
function ttsPlaybackOptions(ctx) {
  const flags=[['跟随高亮','follow',true],['来电自动暂停','interruption',true],['允许与其他应用同时播放','mixing',false],['后台继续朗读','background',true]];
  return `<section class="reading-tts-options"><header><strong>播放配置</strong><span>即时生效</span></header><div class="reading-tts-card"><div class="reading-tts-voice-row"><strong>音色</strong><button data-action="tts-voice"><b>女</b><span>中文 聆小珊女声</span>${icon('reader_appearance_make_chevron',12)}</button></div>${flags.map(([label,key,value])=>toggle(label,ctx.state[`reading-tts-${key}`]??value,`reading-tts-${key}`)).join('')}<div class="reading-tts-cut-off" aria-label="朗读时屏幕常亮控件未完整捕获">朗读时屏幕常亮</div></div></section>`;
}
function ttsView(ctx) {
  const full=ctx.variant.id!=='quick';
  let inner;
  if(!full)inner=`<section class="reading-tts quick"><div class="reading-tts-quick-playback"><i>${icon('reader_tts_headphones',17)}</i><div class="reading-tts-quick-label"><strong>播放</strong><span><b></b>未开始</span></div><button class="reading-tts-previous" data-action="tts-previous" disabled>${icon('reader_tts_make_previous_quick',14)}</button>${ttsPlayButton(false)}<button class="reading-tts-stop" data-action="tts-stop" disabled>${icon('reader_tts_make_stop',10)}</button><button class="reading-tts-next" data-action="tts-next" disabled>${icon('reader_tts_make_next_quick',14)}</button></div><div class="reading-tts-quick-timer"><i>${icon('reader_tts_clock',17)}</i><strong>定时</strong><button data-action="tts-quick-timer">${Number(ctx.state['reading-tts-minutes']??25)} 分钟${icon('reader_chevron_down',8)}</button></div>${ttsRate(ctx,false)}</section>`;
  else {
    const scroll=ctx.variant.id==='engine'?415.428:ctx.variant.id==='playback-options'||ctx.variant.id==='voice-picker'?559.143:0;
    inner=`<section class="reading-tts full" data-scroll-key="reading-tts-scroll" data-initial-scroll="${scroll}"><div class="reading-tts-full-content"><section class="reading-tts-playback"><header><strong>朗读控制</strong><span><b></b>未开始</span></header><div class="reading-tts-card"><div class="reading-tts-wave">${Array.from({length:24},()=>'<i></i>').join('')}</div><div class="reading-tts-main-controls"><button data-action="tts-previous" disabled>${icon('reader_tts_make_previous',26)}</button>${ttsPlayButton(true)}<button data-action="tts-next" disabled>${icon('reader_tts_make_next',26)}</button></div><footer>${icon('reader_tts_header',16)}<strong>当前音色 · 中文 聆小珊女声</strong><button data-action="tts-stop" disabled>${icon('reader_tts_make_stop',10)}<span>停止</span></button></footer></div></section>${ttsRate(ctx,true)}${ttsTimer(ctx)}${ttsEngine()}${ttsPlaybackOptions(ctx)}</div></section>`;
    if(ctx.variant.id==='voice-picker')inner+=`<button class="reading-tts-picker-dismiss" data-action="tts-close-voice" aria-label="关闭音色列表"></button><div class="reading-tts-voice-picker"><b>女</b><button data-action="tts-close-voice"><strong>中文 聆小珊女声</strong><span>普通话</span></button>${button('…',{action:'tts-audition',className:'reading-tts-audition'})}<button class="reading-tts-voice-check" data-action="tts-close-voice" aria-label="已选音色">${icon('reader_tts_make_engine_check',16)}</button></div>`;
  }
  return novelControlShell(inner,{full,title:'朗读',titleIcon:'rc_headphones',active:'tts',screen:'reader-tts'});
}
function ttsAction(action,ctx) {
  if(action==='expand')return {go:{screen:'reader-tts',variant:'full'}};
  if(action==='collapse')return {go:{screen:'reader-tts',variant:'quick'}};
  if(action==='tts-voice')return {go:{screen:'reader-tts',variant:'voice-picker'}};
  if(action==='tts-close-voice')return {go:{screen:'reader-tts',variant:'playback-options'}};
  const match=/^tts-(minutes|seconds)-(increase|decrease)$/.exec(action);
  if(match) {
    const key=`reading-tts-${match[1]}`,step=match[1]==='minutes'?5:1,max=match[1]==='minutes'?180:59;
    return {statePatch:{[key]:Math.max(0,Math.min(max,Number(ctx.state[key]??(match[1]==='minutes'?25:0))+(match[2]==='increase'?step:-step))),'reading-tts-timer-mode':'duration'}};
  }
  if(action.startsWith('tts-timer-')) {
    const value=action.slice(10),minutes=value==='chapterEnd'?0:Number(value);
    return {statePatch:{'reading-tts-minutes':minutes,'reading-tts-seconds':0,'reading-tts-timer-mode':value==='chapterEnd'?'chapterEnd':minutes===0?'off':'duration'}};
  }
  return unobservedAction(action);
}

function novelMore(ctx) {
  return novelControls(ctx).replace('</section>',`<button class="reading-novel-menu-dismiss" data-go="reader-controls" aria-label="关闭更多菜单"></button><div class="reading-novel-menu" role="menu">${button('书籍信息',{action:'novel-more-info',kind:'text'})}${button('刷新本章',{action:'novel-more-refresh',kind:'text'})}${button('下载全部章节',{action:'novel-more-download',kind:'text',className:'muted'})}</div></section>`);
}

function sourceSwitchView(ctx) {
  // Raster pixels are restricted to the book's actual cover. Header, context,
  // status and the observed blank candidate region are independent HTML.
  const comic=ctx.variant.id==='comic-detail-empty';
  const cover=nativeRoot+(comic?'reader-control-redo-076-comic-source-switch.png':'reader-control-redo-001-resumed.png');
  return `<section class="reading-stage reading-source-switch ${comic?'comic-detail':''}"><header><button data-go="${comic?'detail':'reader'}" data-variant="${comic?'manga':'body'}" aria-label="返回">${icon('source_switch_close',20)}</button><h1>更换书源</h1>${button('重查',{action:comic?'source-comic-detail-recheck':'source-recheck',kind:'text'})}</header><section class="reading-source-context"><div class="reading-source-cover" style="--reading-source-cover-offset-y:${comic?'-118.571px':'-116.857px'}"><img src="${cover}" alt="斗破苍穹封面"></div><div><strong>斗破苍穹</strong><span>${comic?'知音漫客 x 任翔 · 当前来源：🔖腾讯漫画':'天蚕土豆 · 当前来源：阅读助手（优+++）'}</span>${comic?'<span>正在读 06</span>':''}</div></section><section class="reading-source-discovery"><div><span>${comic?'查找完成 · 已发现 0 个':'查找完成 · 34 个来源'}</span><span>${comic?'延迟优先':'搜索延迟'}</span></div><p>其他来源</p></section>${comic?'<div class="reading-source-empty"><strong>查找完成 · 已发现 0 个</strong><span>可重新查找，或返回继续阅读</span></div>':''}</section>`;
}

function unobservedAction(action) {
  return {statePatch:{'reading-unverified-action':action}};
}

export const readingScreens = [
  {
    id:'reader',label:'小说阅读',group:'阅读',
    variants:[{id:'body',label:'正文',captureId:'reader-control-redo-003-novel-controls-stable'}],
    render:novelBody,
  },
  {
    id:'reader-controls',label:'小说阅读控制',group:'阅读',
    variants:[{id:'home',label:'控制首页',captureId:'reader-control-redo-004-novel-home'}],
    render:novelControls,onAction:unobservedAction,
  },
  {
    id:'reader-replace',label:'替换规则',group:'阅读',
    variants:[
      {id:'quick',label:'快捷管理 · 当前为空',captureId:'reader-control-redo-005-replace-quick'},
      {id:'quick-preview',label:'快捷预览 · 实际标题重叠待修',captureId:'reader-control-redo-080-replace-quick-preview'},
      {id:'full',label:'完整管理 · 当前为空',captureId:'reader-control-redo-006-replace-full'},
      {id:'editor',label:'新增规则',captureId:'reader-control-redo-007-replace-editor'},
      {id:'editor-options',label:'新增规则 · 下部选项',captureId:'reader-control-redo-008-replace-editor-options'},
      {id:'preview',label:'当前章节预览 · 已保存 0 条',captureId:'reader-control-redo-009-replace-preview'},
    ],
    render:replaceControl,onAction:replaceAction,
  },
  {
    id:'reader-directory',label:'小说章节目录',group:'阅读',
    variants:[{id:'quick',label:'快捷目录',captureId:'reader-control-redo-011-novel-directory-quick'},{id:'full',label:'完整目录',captureId:'reader-control-redo-012-novel-directory-full'}],
    render:directoryView,onAction:directoryAction,
  },
  {
    id:'reader-bookmarks',label:'小说书签',group:'阅读',
    variants:[{id:'quick',label:'快捷书签 · 载入中',captureId:'reader-control-redo-015-novel-bookmarks-quick'},{id:'full',label:'完整书签 · 持续载入中',captureId:'reader-control-redo-014-novel-bookmarks-settled'}],
    render:directoryView,onAction:directoryAction,
  },
  {
    id:'reader-search',label:'内容搜索',group:'阅读',
    variants:[{id:'quick',label:'快捷搜索',captureId:'reader-control-redo-016-content-search-quick'},{id:'full',label:'完整搜索',captureId:'reader-control-redo-017-content-search-full'},{id:'keyboard',label:'输入避让',captureId:'reader-control-redo-018-content-search-keyboard'},{id:'results',label:'萧炎 · 原生结果',captureId:'reader-control-redo-019-content-search-results'}],
    render:searchView,onAction:searchAction,
  },
  {
    id:'reader-autopage',label:'自动翻页',group:'阅读',
    variants:[{id:'quick',label:'快捷控制 · 未开始',captureId:'reader-control-redo-020-autopage-quick'},{id:'full',label:'完整配置 · 未开始',captureId:'reader-control-redo-021-autopage-full'}],
    render:autoPageView,onAction:autoPageAction,
  },
  {
    id:'reader-tts',label:'小说朗读',group:'阅读',
    variants:[{id:'quick',label:'快捷朗读 · 未开始',captureId:'reader-control-redo-028-tts-quick'},{id:'full',label:'完整朗读 · 控制语速计时',captureId:'reader-control-redo-029-tts-full'},{id:'engine',label:'完整朗读 · 引擎',captureId:'reader-control-redo-030-tts-engine'},{id:'playback-options',label:'完整朗读 · 播放配置',captureId:'reader-control-redo-031-tts-playback-options'},{id:'voice-picker',label:'已选音色列表',captureId:'reader-control-redo-032-tts-voice-picker'}],
    render:ttsView,onAction:ttsAction,
  },
  {
    id:'reader-more',label:'小说更多 · 当前应用',group:'阅读',
    variants:[{id:'popup',label:'原生3项锚定菜单',captureId:'reader-control-redo-033-novel-more'}],
    render:novelMore,onAction:unobservedAction,
  },
  {
    id:'reader-more-target',label:'小说更多 · 漫画风格适配提案',group:'阅读',category:'confirmed-demo-unimplemented',
    directionConfirmed:true,finalVisualApproval:false,
    variants:[{id:'comic-style',label:'已确认方向 · 具体视觉待确认',referenceCaptureId:'reader-control-redo-064-comic-more',captureRole:'style-reference',category:'confirmed-demo-unimplemented',directionConfirmed:true,finalVisualApproval:false,admittedBaseline:false,unconfirmedControlVisuals:['314vp面板高度是3个小说动作的适配提案，尚未确认','3项48vp胶囊、24vp间距与底部安全区的具体排版尚未确认','采用漫画更多样式的方向已确认；小说适配后的字体、圆角、色彩与动效仍待视觉确认']}],
    render:novelMoreTarget,onAction:unobservedAction,
  },
  {
    id:'source-switch',label:'更换书源',group:'阅读',
    variants:[{id:'completed-empty-candidates',label:'小说阅读入口 · 34来源 · 候选未显示',captureId:'reader-control-redo-001-resumed'},{id:'comic-detail-empty',label:'漫画详情入口 · 已发现0个来源',captureId:'reader-control-redo-076-comic-source-switch'}],
    render:sourceSwitchView,onAction:unobservedAction,
  },
  {
    id:'manga-reader', label:'漫画阅读', group:'阅读',
    variants:[
      {id:'body',label:'正文',captureId:'reader-control-redo-062-comic-entry'},
      {id:'controls',label:'阅读控制',captureId:'reader-control-redo-063-comic-controls'},
    ],
    render:mangaControlView,
    onAction(action) {
      if (action === 'manga-previous' || action === 'manga-next') {
        return {statePatch:{'reading-unverified-action':action}};
      }
      return unobservedAction(action);
    },
  },
  {
    id:'manga-more',label:'漫画更多 · 当前应用',group:'阅读',
    variants:[{id:'sheet',label:'更多 · 上部',captureId:'reader-control-redo-064-comic-more'},{id:'lower',label:'更多 · 下部',captureId:'reader-control-redo-065-comic-more-lower'}],
    render:mangaMoreView,onAction:mangaMoreAction,
  },
  {
    id:'manga-downloads',label:'漫画本书下载',group:'阅读',
    variants:[{id:'loading',label:'读取下载状态 · 实际过渡',captureId:'reader-control-redo-066-download-manager'},{id:'book-actions',label:'本书下载 · 当前2项操作',captureId:'reader-control-redo-067-comic-download-settled'}],
    render:mangaDownloadsView,onAction:unobservedAction,
  },
  {
    id:'manga-directory',label:'漫画章节目录',group:'阅读',
    variants:[{id:'sheet',label:'独立底部目录 · 当前06',captureId:'reader-control-redo-068-comic-directory'}],
    render:mangaDirectoryView,onAction:unobservedAction,
  },
  {
    id:'manga-mode',label:'漫画阅读方式',group:'阅读',
    variants:[{id:'sheet',label:'竖向连续 · 跟随书源',captureId:'reader-control-redo-069-comic-mode'}],
    render:mangaModeView,onAction:unobservedAction,
  },
  {
    id:'manga-settings',label:'漫画阅读设置',group:'阅读',
    variants:[{id:'sheet',label:'暖纸 · 亮度50% · 常驻页码开',captureId:'reader-control-redo-070-comic-settings'}],
    render:mangaSettingsView,onAction:unobservedAction,
  },
];

// Classification of business structure remains independent of the custom
// control paint. Native captures admit observed states, not final visual approval.
const readingCustomVisuals = {
  'reader-controls':['自定义亮度Slider的轨道、滑块、焦点和点击态尚未确认'],
  'reader-search':['内容搜索TextInput和按钮的自定义焦点、边框、按下态外观尚未确认'],
  'reader-autopage':['自定义速度Slider及计时选择器的焦点、滑块、数字排版尚未确认'],
  'reader-tts':['语速Slider、计时数字与播放Toggle的自定义焦点、滑块和过渡外观尚未确认'],
  'manga-directory':['目录搜索TextInput的自定义边框、焦点和输入态外观尚未确认'],
  'manga-settings':['亮度Slider与常驻页码Toggle的自定义轨道、滑块和过渡外观尚未确认'],
};
function readingUnconfirmedPaint(screenId, variantId) {
  if (screenId === 'reader-replace') {
    if (variantId.startsWith('quick')) return readingCustomVisuals['reader-controls'];
    if (variantId.startsWith('editor')) return ['新增规则TextInput与Toggle的自定义边框、焦点、滑块和过渡外观尚未确认'];
    return [];
  }
  if (screenId === 'reader-directory') return variantId === 'quick'
    ? readingCustomVisuals['reader-controls']
    : ['完整目录搜索TextInput的自定义焦点、边框和输入态外观尚未确认'];
  if (screenId === 'reader-bookmarks') return variantId === 'quick' ? readingCustomVisuals['reader-controls'] : [];
  if (screenId === 'manga-reader') return variantId === 'controls' ? ['阅读进度Slider的自定义轨道、滑块和焦点外观尚未确认'] : [];
  return readingCustomVisuals[screenId] || [];
}
for (const screen of readingScreens) {
  if (screen.category === 'confirmed-demo-unimplemented') continue;
  screen.category = 'existing-app';
  screen.status = 'native-observed';
  screen.visualAcceptance = 'OPEN';
  for (const variant of screen.variants) {
    variant.category = 'existing-app';
    variant.status = 'native-observed';
    variant.nativeFrameObserved = true;
    variant.visualAcceptance = 'OPEN';
    const details = readingUnconfirmedPaint(screen.id, variant.id);
    if (details.length) variant.unconfirmedControlVisuals = details;
  }
}

export const readingPendingScreens = [
  {id:'manga-end',label:'漫画章节结束',category:null,classification:null,classificationStatus:'pending',candidateCategory:'existing-app',admittedBaseline:false,status:'pending-native-capture',evidenceKind:'source-reference-only'},
];
