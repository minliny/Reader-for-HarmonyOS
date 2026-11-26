const SHELF_NOVEL = 'ReaderShelfNovel';
const NEW_NOVEL = 'ReaderNewNovel';
const COMIC = 'ReaderComic';
const LOCAL_TXT = 'Reader Phase 1 公共长目录';
const NO_MATCH = 'ReaderNoMatchKeyword99999';
const FIRST_REMOTE_CHAPTER = '第一章 启程';
const SECOND_REMOTE_CHAPTER = '第二章 校验';
const SECOND_LOCAL_CHAPTER = '第二章 测试编号 02';
const THIRD_LOCAL_CHAPTER = '第三章 测试编号 03';

const id = id => ({ id });
const text = text => ({ text });
const action = label => ({ label, enabled: 'true', type: 'Button' });
const tab = route => ({ id: `reader-main-tab-${route}`, enabled: 'true' });
const searchField = id('reader-book-search-input');
const searchEntry = id('reader-bookshelf-search-entry');
const searchSubmit = id('reader-bookshelf-search-submit');
const shelfMore = { id: /^bookshelf-back:\d+$/, enabled: 'true' };
const shelfMoreSheet = id('reader-bookshelf-more-sheet');
const viewCover = id('reader-bookshelf-view-cover');
const viewList = id('reader-bookshelf-view-list');
const shelfFilterToggle = id('reader-bookshelf-filter-toggle');
const shelfFilterLocal = id('reader-bookshelf-filter-source-local');
const shelfFilterAll = id('reader-bookshelf-filter-source-all');
const downloadManagement = { id: /^reader-bookshelf-more-action-.*::downloads$/, enabled: 'true' };
const readingStage = id('reader-reading-stage');
const readerDirectory = id('reader-control-entry-directory');
const readerDirectoryContent = id('reader-control-module-directory');
const switchSource = { id: /^reader-source-trigger:.*"detail-source"\]$/, enabled: 'true' };
const sourceA = id(/^reader-source-trigger:.*novel-a\.reader-journeys\.invalid.*"detail-source"\]$/);
const sourceB = id(/^reader-source-trigger:.*novel-b\.reader-journeys\.invalid.*"detail-source"\]$/);
const currentSourceName = name => ({ type: 'Text', text: name, within: { type: 'Scroll' } });
const unavailableSourceName = currentSourceName(/^(书源名称暂不可用|书源未知)$/);
const switchClose = { id: /^reader-source-close:/, enabled: 'true' };
const addBook = { id: 'reader-detail-shelf-action:加入书架', enabled: 'true' };
const removeBook = { id: 'reader-detail-shelf-action:移除书架', enabled: 'true' };
const readBook = { id: 'reader-detail-primary-action', enabled: 'true' };
const shelfRowNovelMore = { id: /^reader-shelf-book-action:.*ReaderShelfNovel",true\]$/, enabled: 'true' };
const shelfRowLocalMore = { id: /^reader-shelf-book-action:.*,"local",.*true\]$/, enabled: 'true' };
const shelfRowLocalCard = { id: /^reader-shelf-book-action:.*,"local",.*false\]$/, enabled: 'true' };
const localContinueCard = id(/^reader\.bookshelf\.continue-card:\d+:\["local",/);
const localShelfProgress = within => ({ type: 'Text', text: /^(?:进度未知|(?:<1|\d+)%)$/, within });
const bookActions = id('reader-bookshelf-book-action-sheet');
const bookInfo = { id: /^reader-bookshelf-book-action-.*::book-info$/, enabled: 'true', within: bookActions };
const activePage = { id: /^reader-page-slot-[ab]$/, enabled: 'true' };
const enabled = id => ({ id, enabled: 'true' });
const label = label => ({ label, enabled: 'true', clickable: 'true' });
const selected = selector => ({ ...selector, selected: 'true' });
const stageMode = mode => id('reader-reading-interaction-host-' + mode);
const entry = name => enabled('reader-control-entry-' + name);
const moduleId = name => id('reader-control-module-' + name);
const transport = (service, kind, active = true) => ({ id: `reader-control-${service}-transport-${kind}`, enabled: String(active) });
const close = label('关闭');
const appearance = moduleId('appearance');
const readerSettings = moduleId('settings');
const bookshelfReady = { route: 'bookshelf', all: [searchEntry, text(LOCAL_TXT)], modalOpen: false };
const settingsHome = { route: 'settings', all: [text('设置'), tab('settings')] };
const settingsScroll = { type: 'Scroll' };
const general = enabled('reader-settings-general');
const steadyReader = mode => ({ route: 'reading', all: [readingStage, stageMode(mode)], modalOpen: false });
const surface = subject => ({ kind: 'surface', action: 'mount', subject, rules: ['T1'] });
const routeMotion = (action, subject) => ({ kind: 'route', action, subject, rules: ['T2'] });
const chapterAdvance = subject => ({ kind: 'chapter', action: 'advance', subject, rules: ['T4'] });
const launch = action => ({ kind: 'launch', action, subject: 'reader-session-launch', rules: ['T3'] });

export async function applyVmJourneyProfile(ui) {
  await ui.wait('确认公开夹具已启动并原生扫描书架', { ...bookshelfReady, requiredRules: ['R13'] });
  const { scheme, material, motion } = ui.profile;
  if (scheme || material || motion) {
    await ui.tap('访问旅程环境设置', tab('settings'), settingsHome);
    await reveal(ui, general, settingsScroll, '设置首页', 'down');
    await ui.tap('打开通用设置', general, { route: 'settings', all: [text('App 主题')] });
    if (scheme && scheme !== ui.scheme()) {
      const themeOption = label(scheme === 'night' ? '深色' : '浅色');
      await ui.tap('设置并回读应用主题', themeOption, { route: 'settings', all: [selected(themeOption)], scheme });
    }
    if (material && ui.environment()?.material !== material) {
      const render = label(material === 'native' ? '效果优先' : '性能优先');
      if (!ui.has(selected(render))) {
        await ui.tap('设置并回读渲染模式', render, { route: 'settings', all: [selected(render)] });
      }
      if (material === 'native' && !ui.has(selected(label('原生')))) {
        await ui.tap('请求原生界面外观', label('原生'), { route: 'settings', all: [selected(label('原生'))] });
      }
    }
    if (motion && ui.environment()?.reducedMotion !== (motion === 'reduced')) {
      const toggle = { type: 'Toggle', label: '减少动态效果', enabled: 'true' };
      if (!ui.has(toggle)) ui.block('系统减弱动效生效或当前窗口未暴露可操作的减弱动效开关');
      await ui.tap('设置并回读减弱动效', toggle, { route: 'settings', reducedMotion: motion === 'reduced' });
    }
    await ui.key('从通用设置返回设置首页', 'Back', settingsHome);
    await ui.tap('结束环境配置并返回书架', tab('bookshelf'), bookshelfReady);
  }
  ui.assertProfile();
}

async function reveal(ui, selector, scroll, name, direction = 'up') {
  for (let attempt = 0; attempt < 4 && !ui.has(selector); attempt += 1) {
    await ui.swipe(`滚动${name}定位目标（${attempt + 1}）`, scroll, direction, { all: [scroll] });
  }
}

async function controls(ui, name) {
  await ui.tap('从正文打开阅读控制', readingStage, { route: 'reading', all: [entry(name)] });
  await ui.tap(`打开阅读控制模块 ${name}`, entry(name), { route: 'reading', all: [moduleId(name)], modalOpen: true });
}

async function ensureReadingMode(ui, mode = ui.profile.readingMode ?? 'paged') {
  if (!ui.has(stageMode(mode))) {
    await controls(ui, 'settings');
    const option = enabled(`reader-control-settings-pageTurn-${mode === 'continuous' ? 'scroll' : 'cover'}`);
    await ui.tap(`设置并回读阅读方式 ${mode}`, option, { route: 'reading', all: [selected(option)] });
    await ui.key('关闭阅读设置模块', 'Back', { route: 'reading', all: [entry('settings')] });
    await ui.key('关闭阅读控制，确认原生正文阅读方式', 'Back', steadyReader(mode));
  } else {
    await ui.wait(`核对原生正文阅读方式 ${mode}`, steadyReader(mode));
  }
  ui.observedReadingMode(mode);
  return mode;
}

async function openLocalReader(ui) {
  await openLocalDetail(ui);
  await ui.tap('从本地详情进入正文', readBook, { route: 'reading', all: [readingStage], modalOpen: false });
  return ensureReadingMode(ui);
}

async function openReadingDirectory(ui) {
  await controls(ui, 'directory');
  await ui.wait('确认目录显示真实公开章节', { route: 'reading', all: [chapterRow(SECOND_LOCAL_CHAPTER), chapterRow(THIRD_LOCAL_CHAPTER)] });
}

const chapterRow = title => ({ text: title, within: [readerDirectoryContent, { type: 'ListItem' }] });
const controlTitle = title => ({ text: `${title} · 本地书籍`, within: id('reader-control-motion-topbar') });

async function jumpToLocalChapter(ui, target) {
  await ui.tap(`选择目录锚点 ${target}`, chapterRow(target), {
    route: 'reading', all: [readingStage, controlTitle(target)], none: [readerDirectoryContent],
    transition: chapterAdvance('reader-chapter-local'), filmstrip: true,
  });
}

async function openSettings(ui) {
  await ui.tap('打开设置首页', tab('settings'), settingsHome);
}

async function openLicenses(ui) {
  const about = action('关于 Reader');
  const licenses = action('查看开源许可与声明');
  const notices = action('第三方组件声明');
  await reveal(ui, about, settingsScroll, '设置首页');
  await ui.tap('从其他组进入关于 Reader', about, { route: 'settings', all: [licenses] });
  await ui.tap('从关于页打开开源许可', licenses, {
    route: 'settings', all: [text('开源许可与声明'), notices], transition: routeMotion('push', 'settings-licenses'), filmstrip: true,
  });
  await ui.tap('打开已打包的第三方组件声明', notices, {
    route: 'settings', all: [text(/^Reader: notices for the crypto \/ EPUB structural-parser reuse slice\./u)],
    none: [text('许可文件暂时无法读取')], screenCapture: true,
  });
  await ui.key('从声明正文返回许可列表', 'Back', { route: 'settings', all: [notices, text('许可文件')] });
  await ui.key('从开源许可返回关于页并验证 pop', 'Back', {
    route: 'settings', all: [licenses], none: [text('开源许可与声明')], transition: routeMotion('pop', 'settings-licenses'), filmstrip: true,
  });
  await ui.key('从关于页返回四组设置', 'Back', settingsHome);
}

const capsule = (service, running) => action(`${service}${running ? '播放中，点击暂停' : '已暂停，点击继续'}`);

async function togglePlayback(ui, serviceLabel, mode) {
  const running = capsule(serviceLabel, true);
  const paused = capsule(serviceLabel, false);
  await ui.tap(`暂停${serviceLabel}`, running, { ...steadyReader(mode), all: [stageMode(mode), paused], none: [running] });
  await ui.tap(`继续${serviceLabel}`, paused, { ...steadyReader(mode), all: [stageMode(mode), running], none: [paused] });
}

function searchRow(title) {
  return { id: new RegExp(`^reader-search-result:.*${title.toLowerCase()}`), enabled: 'true' };
}

async function coldShelf(ui) {
  await ui.wait('冷启动后显示本地与在线书架条目', {
    route: 'bookshelf', all: [searchEntry, text(SHELF_NOVEL), text(LOCAL_TXT)], modalOpen: false,
  });
}

async function search(ui, title, inBookshelf, screenCapture = false) {
  await ui.tap('打开书架搜索', searchEntry, { route: 'search', all: [searchField] });
  await ui.input(`填写书名 ${title}`, searchField, title, { route: 'search', all: [searchField] });
  await ui.tap(`执行搜索 ${title}`, searchSubmit, {
    route: 'search', all: [searchRow(title), text(title)],
  });
  const membershipBadge = { ...text('已在书架'), within: searchRow(title) };
  const settledSearch = { ...text('搜索'), within: searchSubmit };
  await ui.wait(`核对 ${title} 的搜索结果归属`, {
    route: 'search', all: [searchRow(title), ...(inBookshelf ? [membershipBadge] : []), ...(screenCapture ? [settledSearch] : [])],
    none: inBookshelf ? [] : [membershipBadge], screenCapture,
  });
}

async function openShelfMore(ui) {
  await ui.tap('打开书架更多抽屉', shelfMore, {
    route: 'bookshelf', all: [shelfMoreSheet, text('书架操作'), downloadManagement], modalOpen: true,
  });
}

async function openLocalDetail(ui, captureBookActions = false) {
  if (!ui.has(shelfRowLocalMore)) {
    await ui.tap('切到书架列表以访问本地书操作', viewList, {
      route: 'bookshelf', all: [shelfRowLocalMore],
    });
  }
  await ui.tap('打开本地书操作抽屉', shelfRowLocalMore, {
    route: 'bookshelf', all: [bookActions, bookInfo], modalOpen: true, screenCapture: captureBookActions,
  });
  await ui.tap('打开已导入 TXT 的书籍信息', bookInfo, {
    route: 'detail', all: [text(LOCAL_TXT), text('本地藏书'), readBook], modalOpen: false,
  });
}

export const journeys = {
  async J1(ui) {
    await coldShelf(ui);
    await ui.tap('切换封面模式', viewCover, {
      route: 'bookshelf', all: [text(LOCAL_TXT), text(SHELF_NOVEL)], none: [shelfRowNovelMore], screenCapture: true,
    });
    await ui.tap('切换列表模式', viewList, {
      route: 'bookshelf', all: [shelfRowNovelMore, shelfRowLocalMore],
      none: [{ ...text('*%'), within: localContinueCard }, { ...text('*%'), within: shelfRowLocalCard }],
      sameText: [localShelfProgress(localContinueCard), localShelfProgress(shelfRowLocalCard)],
      screenCapture: true,
    });
    await ui.tap('展开书架筛选', shelfFilterToggle, {
      route: 'bookshelf', all: [shelfFilterLocal, shelfFilterAll],
    });
    await ui.tap('筛选本地书籍', shelfFilterLocal, {
      route: 'bookshelf', all: [shelfRowLocalMore], none: [shelfRowNovelMore],
    });
    await ui.tap('恢复全部来源', shelfFilterAll, {
      route: 'bookshelf', all: [shelfRowNovelMore, shelfRowLocalMore],
    });
    await ui.tap('收起书架筛选', shelfFilterToggle, {
      route: 'bookshelf', all: [shelfFilterToggle], none: [shelfFilterLocal],
    });
    await openShelfMore(ui);
    await ui.key('系统返回关闭书架更多抽屉', 'Back', {
      route: 'bookshelf', all: [shelfMore, searchEntry], none: [shelfMoreSheet], modalOpen: false,
    });
    const groups = enabled(/^reader-bookshelf-book-action-.*::edit-group$/);
    const multiSelect = enabled(/^reader-bookshelf-book-action-.*::multi-select$/);
    await ui.tap('打开公开本地书的动作', shelfRowLocalMore, { all: [groups, multiSelect], modalOpen: true });
    await ui.tap('打开编辑分组弹窗', groups, {
      route: 'bookshelf', all: [text('编辑分组'), selected(action('默认分组')), close],
      requiredRules: ['R9', 'R10'], screenCapture: true,
    });
    await ui.tap('关闭分组编辑，保留书架条目', close, { ...bookshelfReady, all: [shelfRowLocalMore] });
    await ui.tap('再次打开本地书动作', shelfRowLocalMore, { all: [multiSelect], modalOpen: true });
    await ui.tap('进入多选并核对被选中书目', multiSelect, {
      route: 'bookshelfMultiSelect', all: [text(LOCAL_TXT), text('已选择 1 本')], requiredRules: ['R8', 'R13'],
    });
    const chosen = label(new RegExp(`^${LOCAL_TXT}，已选择$`, 'u'));
    await ui.tap('撤销对该书的选中', chosen, { route: 'bookshelfMultiSelect', all: [text('已选择 0 本')], none: [chosen] });
    await ui.key('退出多选并保留原书架', 'Back', bookshelfReady);
    await openShelfMore(ui);
    await ui.tap('打开本地导入并核对可用入口', enabled(/^reader-bookshelf-more-action-.*::import$/), {
      route: 'bookshelf', all: [text('导入本地书籍'), action('选择文件'), action('取消')],
      requiredRules: ['R9', 'R10'], screenCapture: true,
    });
    const selectLocal = { ...action('选择文件'), first: true };
    await ui.tap('提交公开夹具的原书并核对重复导入回读', selectLocal, {
      route: 'bookshelf', all: [text('导入完成'), { text: '已在书架', type: 'Text' }, action('完成')],
      none: [text('新增成功')], screenCapture: true,
    });
    await ui.tap('完成导入，原书条目保持可操作', action('完成'), bookshelfReady);
    ui.externalCoverage('系统文件提供方选择与授权', '本旅程使用隔离夹具的已验证原书');
  },

  async J2(ui) {
    await coldShelf(ui);
    await search(ui, SHELF_NOVEL, true);
    await ui.tap('从已入架的搜索结果打开详情', searchRow(SHELF_NOVEL), {
      route: 'detail', all: [text(SHELF_NOVEL), sourceA, removeBook, switchSource, currentSourceName('ReaderNovelA')],
      none: [unavailableSourceName],
    });
    await ui.tap('打开详情换源抽屉', switchSource, {
      route: 'detail', all: [switchClose], modalOpen: true,
    });
    await ui.tap('关闭换源并验证详情动作恢复', switchClose, {
      route: 'detail', all: [removeBook, switchSource, currentSourceName('ReaderNovelA')],
      none: [switchClose, unavailableSourceName], modalOpen: false, screenCapture: true,
    });
    const alternative = { type: 'Row', label: /^(ReaderNovelB|https:\/\/novel-b\.reader-journeys\.invalid)(?:[,，]|$)/,
      enabled: 'true', clickable: 'true' };
    await ui.tap('重新打开换源并等待可用备选', switchSource, {
      route: 'detail', all: [switchClose, alternative], modalOpen: true, screenCapture: true,
    });
    await ui.tap('切换到 ReaderNovelB 并进入阅读', alternative, {
      route: 'reading', all: [readingStage, id(/^reader-source-trigger:.*novel-b\.reader-journeys\.invalid.*"reader-body"\]$/)],
      none: [switchClose], modalOpen: false,
    });
    await ensureReadingMode(ui);
    await ui.key('从切源后的阅读返回详情', 'Back', {
      route: 'detail', all: [text(SHELF_NOVEL), sourceB, removeBook, switchSource, currentSourceName('ReaderNovelB')],
      none: [unavailableSourceName], modalOpen: false,
    });
    await ui.key('返回搜索并核对新源仍对应在架书籍', 'Back', {
      route: 'search', all: [{ ...text('已在书架'), within: searchRow(SHELF_NOVEL) }],
    });
    await ui.tap('清除当前搜索词并恢复历史', enabled('reader-book-search-clear'), {
      route: 'search', all: [searchField, id('reader-search-history-viewport'),
        { text: SHELF_NOVEL, within: id('reader-search-history-viewport') }],
      none: [searchRow(SHELF_NOVEL)], requiredRules: ['R12'], screenCapture: true,
    });
    await ui.tap('清空公开夹具的搜索历史', label('清空搜索历史'), {
      route: 'search', all: [text('暂无搜索历史'), searchField],
      none: [{ text: SHELF_NOVEL, within: id('reader-search-history-viewport') }], requiredRules: ['R12'],
    });
  },

  async J3(ui) {
    await coldShelf(ui);
    await search(ui, NEW_NOVEL, false, true);
    await ui.tap('打开未入架的新书详情', searchRow(NEW_NOVEL), {
      route: 'detail', all: [text(NEW_NOVEL), addBook], none: [removeBook],
    });
    await ui.tap('加入书架并等待入架回读', addBook, {
      route: 'detail', all: [removeBook], none: [addBook],
    });
    await ui.key('回到搜索确认已入架标签同步', 'Back', {
      route: 'search', all: [{ ...text('已在书架'), within: searchRow(NEW_NOVEL) }],
    });
    await ui.tap('重新打开已入架详情', searchRow(NEW_NOVEL), {
      route: 'detail', all: [removeBook],
    });
    await ui.tap('打开移除书架确认', removeBook, {
      route: 'detail', all: [text('移出书架'), text(/^确定将“ReaderNewNovel”从书架移除吗/), { type: 'Text', text: '移除' }],
    });
    await ui.tap('确认移除并等待入架状态复位', { type: 'Text', text: '移除' }, {
      route: 'detail', all: [addBook], none: [text('移出书架'), removeBook], modalOpen: false,
    });
    await ui.key('从详情返回搜索并核对标签撤下', 'Back', {
      route: 'search', all: [searchRow(NEW_NOVEL)], none: [{ ...text('已在书架'), within: searchRow(NEW_NOVEL) }],
    });
    await ui.key('回到书架核对新书已移除', 'Back', {
      route: 'bookshelf', all: [text(SHELF_NOVEL), text(LOCAL_TXT)], none: [text(NEW_NOVEL)],
    });
  },

  async J4(ui) {
    await coldShelf(ui);
    const mode = await openLocalReader(ui);
    const pageA = { id: 'reader-page-slot-a', enabled: 'true' };
    const pageB = { id: 'reader-page-slot-b', enabled: 'true' };
    if (mode === 'paged') {
      const [beforeSwipe, afterSwipe] = ui.has(pageA) ? [pageA, pageB] : [pageB, pageA];
      await ui.swipe('左滑翻页并核对绘制页面切换', readingStage, 'left', {
        route: 'reading', all: [readingStage, afterSwipe], none: [beforeSwipe], screenCapture: true,
      });
    } else {
      await ui.swipe('连续正文向上滚动', stageMode(mode), 'up', { ...steadyReader(mode), screenCapture: true });
    }
    await openReadingDirectory(ui);
    const target = ui.has(controlTitle(SECOND_LOCAL_CHAPTER)) ? THIRD_LOCAL_CHAPTER : SECOND_LOCAL_CHAPTER;
    await jumpToLocalChapter(ui, target);
    await ui.key('退出本地阅读返回详情', 'Back', {
      route: 'detail', all: [text(LOCAL_TXT), readBook],
    });
    await ui.key('从本地详情返回书架', 'Back', { route: 'bookshelf', all: [text(LOCAL_TXT)] });
  },

  async J5(ui) {
    await coldShelf(ui);
    await openShelfMore(ui);
    const novelRow = { id: /^reader-download:book-title:.*ReaderShelfNovel/, enabled: 'true' };
    const downloadFilter = id('reader-download:filter');
    await ui.tap('从书架进入下载管理', downloadManagement, {
      route: 'downloads', all: [text('下载管理'), novelRow, downloadFilter], modalOpen: false, screenCapture: true,
    });
    await ui.tap('打开下载状态筛选', downloadFilter, {
      route: 'downloads', all: [text('筛选'), text('全部状态')], modalOpen: true, requiredRules: ['R9', 'R10'],
    });
    await ui.key('关闭下载筛选后恢复列表交互', 'Back', {
      route: 'downloads', all: [novelRow, downloadFilter], none: [text('全部状态')], modalOpen: false,
    });
    await ui.tap('打开在线小说的章节下载列表', novelRow, {
      route: 'downloads', all: [text('章节下载'), text(FIRST_REMOTE_CHAPTER), text(SECOND_REMOTE_CHAPTER)],
    });
    const secondChapterActions = { id: /^reader-download:chapter-menu:.*\/book\/ReaderShelfNovel\/chapter\/2/, enabled: 'true' };
    const savedChapter = { id: /chapter-reading:.*\/book\/ReaderShelfNovel\/chapter\/2.*"action"\]$/, enabled: 'true' };
    const downloadChapter = { id: 'reader-download:sheet-action:download', enabled: 'true' };
    const chapterSheet = { route: 'downloads', all: [text(/^章节操作 · 已选 1/)], modalOpen: true };
    const cached = ui.has(savedChapter);
    await ui.tap('打开第二章操作', secondChapterActions, chapterSheet);
    if (cached) {
      const confirm = { id: 'reader-download:confirm', enabled: 'true' };
      await ui.tap('打开公开样本第二章的缓存删除确认', { id: 'reader-download:sheet-action:deleteLocal', enabled: 'true' }, {
        route: 'downloads', all: [text(/^确认删除内容 · 1章/), confirm], modalOpen: true,
      });
      await ui.tap('仅删除公开样本第二章的缓存以重跑下载', confirm, {
        route: 'downloads', all: [secondChapterActions], none: [savedChapter, confirm], modalOpen: false,
      });
      await ui.tap('重新打开第二章操作', secondChapterActions, chapterSheet);
    }
    await ui.tap('下载第二章并等待已保存的章节状态', downloadChapter, {
      route: 'downloads', all: [text(SECOND_REMOTE_CHAPTER), savedChapter], modalOpen: false, requiredRules: ['R8', 'R13'],
    });
    await ui.key('从章节下载返回管理首页并核对计数', 'Back', {
      route: 'downloads', all: [{ text: /^已下载 [12] \/ 2 章$/, within: novelRow }],
    });
    await ui.key('退出下载管理回到书架', 'Back', { route: 'bookshelf', all: [searchEntry] });
  },

  async J6(ui) {
    await coldShelf(ui);
    await search(ui, COMIC, false);
    await ui.tap('从搜索打开漫画详情', searchRow(COMIC), {
      route: 'detail', all: [text(COMIC), readBook],
    });
    const mangaStage = id(/^reader-source-trigger:.*comic-.*"reader-body"\]$/);
    await ui.tap('进入漫画阅读并等待原生图片列表', readBook, {
      route: 'reading', all: [mangaStage, { type: 'ListItem', within: mangaStage }],
    });
    const mangaSwitch = { id: /^reader-source-trigger:.*"manga-source"\]$/, enabled: 'true' };
    await ui.tap('点漫画画布唤出工具栏', mangaStage, {
      route: 'reading', all: [mangaSwitch, { type: 'Slider', within: mangaStage }], screenCapture: true,
    });
    const mangaPosition = { type: 'Slider', label: '漫画页码', within: mangaStage };
    await ui.slideTo('定位漫画章末并核对页码', mangaPosition, 1, {
      route: 'reading', all: [mangaPosition, text('2 / 2'), action('上一页')], screenCapture: true,
    });
    await ui.tap('退到首张并核对上一页不可用', action('上一页'), {
      route: 'reading', all: [text('1 / 2'), mangaSwitch], none: [action('上一页')],
    });
    const mangaPicker = {
      route: 'reading', all: [switchClose, text(/^(ReaderComic[AB]|https:\/\/comic-[ab]\.reader-journeys\.invalid)$/)], modalOpen: true,
    };
    const mangaToolbar = {
      route: 'reading', all: [mangaStage, mangaSwitch], none: [switchClose], modalOpen: false,
    };
    await ui.tap('打开漫画换源抽屉并等待候选来源', mangaSwitch, mangaPicker);
    await ui.tap('关闭漫画换源抽屉并恢复原阅读工具栏', switchClose, mangaToolbar);
    await ui.tap('使用恢复后的工具栏再次打开漫画换源', mangaSwitch, mangaPicker);
    await ui.key('系统返回关闭再次打开的抽屉', 'Back', mangaToolbar);
    await ui.key('退出漫画阅读并返回漫画详情', 'Back', {
      route: 'detail', all: [text(COMIC), readBook], modalOpen: false,
    });
  },

  async J7(ui) {
    await coldShelf(ui);
    await ui.tap('切换到发现', tab('discover'), {
      route: 'discover', all: [text('发现'), tab('rss')],
    });
    await ui.tap('切换到 RSS', tab('rss'), {
      route: 'rss', all: [text('RSS'), tab('settings')],
    });
    await ui.tap('切换到设置', tab('settings'), {
      ...settingsHome, requiredRules: ['R13'], screenCapture: true,
    });
    await reveal(ui, general, settingsScroll, '设置首页', 'down');
    for (const [heading, endpoint] of [['通用与界面', general], ['内容与阅读', enabled('reader-settings-source-management')],
      ['数据与存储', action('下载管理')], ['其他', action('关于 Reader')]]) {
      await reveal(ui, endpoint, settingsScroll, '设置首页');
      await ui.wait(`核对设置分组 ${heading} 和其入口`, { route: 'settings', all: [text(heading), endpoint] });
    }
    await openLicenses(ui);
    await reveal(ui, enabled('reader-settings-source-management'), settingsScroll, '设置首页', 'down');
    await ui.tap('打开书源管理并核对已导入的书源', id('reader-settings-source-management'), {
      route: 'source', all: [text('书源管理'), id('reader-source-content'), text(/^ReaderNovel[AB]$/)], screenCapture: true,
    });
    await ui.key('从书源管理返回设置', 'Back', {
      route: 'settings', all: [id('reader-settings-source-management'), tab('bookshelf')],
    });
    await ui.tap('切回书架并核对原条目', tab('bookshelf'), {
      route: 'bookshelf', all: [searchEntry, text(SHELF_NOVEL), text(LOCAL_TXT)],
    });
  },

  async J8(ui) {
    const localShelf = { route: 'bookshelf', all: [searchEntry, text(LOCAL_TXT)], modalOpen: false };
    await ui.wait('冷启动并核对无书源夹具的本地 TXT', localShelf);
    if (!ui.has(shelfRowLocalMore)) {
      await ui.tap('切到列表以保留待测本地书操作', viewList, {
        ...localShelf, all: [...localShelf.all, shelfRowLocalMore],
      });
    }
    await ui.tap('打开搜索以核对无结果态', searchEntry, { route: 'search', all: [searchField] });
    await ui.input('填写公开无匹配关键词', searchField, NO_MATCH, { route: 'search', all: [searchField] });
    await ui.tap('提交搜索并核对无结果态', searchSubmit, {
      route: 'search', all: [text('没有找到相关书籍'), text(`已搜索 0 个书源,未找到「${NO_MATCH}」的相关结果`)],
      none: [id(/^reader-search-result:/)], requiredRules: ['R7', 'R12'], screenCapture: true,
    });
    await ui.key('从无结果态返回书架并保留本地书列表项', 'Back', {
      ...localShelf, all: [...localShelf.all, shelfRowLocalMore],
    });

    await openLocalDetail(ui, true);
    await ui.tap('打开本地 TXT 并等待正文', readBook, { route: 'reading', all: [readingStage] });
    const mode = await ensureReadingMode(ui);
    const appearanceEntry = { id: 'reader-control-entry-appearance', enabled: 'true' };
    const appearance = id('reader-control-module-appearance');
    const readerTheme = scheme => ({ id: `reader-control-theme-${scheme}`, enabled: 'true', within: appearance });
    await ui.tap('唤出阅读控制并定位外观入口', readingStage, {
      route: 'reading', all: [appearanceEntry], modalOpen: true,
    });
    await ui.tap('打开阅读外观设置', appearanceEntry, {
      route: 'reading', all: [appearance, readerTheme('day'), readerTheme('night')], modalOpen: true,
    });
    if (ui.scheme() === 'night') {
      await ui.tap('先将公开样本切到日间以验证夜间切换', readerTheme('day'), {
        route: 'reading', all: [readerTheme('day'), readerTheme('night')], modalOpen: true, scheme: 'day',
      });
    }
    await ui.tap('选择夜间阅读主题并确认应用深色生效', readerTheme('night'), {
      route: 'reading', all: [appearance], modalOpen: true, scheme: 'night',
    });
    await ui.key('从阅读外观设置返回阅读控制', 'Back', {
      route: 'reading', all: [appearanceEntry], none: [appearance], modalOpen: true, scheme: 'night',
    });
    await ui.key('关闭阅读控制并核对夜间正文的主输入恢复', 'Back', {
      route: 'reading', all: [readingStage, stageMode(mode)],
      none: [appearanceEntry, appearance], modalOpen: false, scheme: 'night', requiredRules: ['R5', 'R6'], screenCapture: true,
    });
    await ui.key('返回夜间详情并核对本地书动作', 'Back', {
      route: 'detail', all: [text(LOCAL_TXT), readBook], modalOpen: false, scheme: 'night', requiredRules: ['R7'],
    });
    await ui.key('返回夜间书架并核对原条目', 'Back', {
      ...localShelf, all: [...localShelf.all, shelfRowLocalCard], scheme: 'night', requiredRules: ['R7'],
    });
    await ui.tap('点击返回后保留的本地书卡继续阅读', shelfRowLocalCard, {
      route: 'reading', all: [readingStage, stageMode(mode)], modalOpen: false, scheme: 'night',
    });
    await ui.key('从书架卡片发起的阅读返回夜间书架', 'Back', {
      ...localShelf, scheme: 'night', requiredRules: ['R7'],
    });
    const general = { id: 'reader-settings-general', enabled: 'true' };
    const day = action('浅色');
    await ui.tap('打开夜间设置首页', tab('settings'), {
      ...settingsHome, modalOpen: false, scheme: 'night',
    });
    await reveal(ui, general, settingsScroll, '设置首页', 'down');
    await ui.tap('进入夜间通用设置核对主题控件', general, {
      route: 'settings', all: [text('App 主题'), day, { ...action('深色'), selected: 'true' }],
      modalOpen: false, scheme: 'night', screenCapture: true,
    });
    await ui.tap('切回日间并核对通用设置恢复', day, {
      route: 'settings', all: [text('App 主题'), { ...day, selected: 'true' }], modalOpen: false, scheme: 'day',
    });
  },

  async J9(ui) {
    const mode = await openLocalReader(ui);
    const tts = moduleId('tts');
    const scroll = { type: 'Scroll', within: tts };
    const toggle = transport('tts', 'toggle');
    const next = transport('tts', 'next');
    const previous = transport('tts', 'previous');
    const stop = transport('tts', 'stop');
    const stopDisabled = transport('tts', 'stop', false);
    const picker = id('reader-control-tts-overlay');
    const manager = id('reader-control-tts-manager-overlay');
    const choiceRow = field => enabled(new RegExp(`^reader-tts-config:\\d+:${field}$`));
    await controls(ui, 'tts');
    await ui.wait('核对停止不可用和播放可用分别呈现', {
      route: 'reading', all: [tts, toggle, stopDisabled], none: [stop],
      requiredRules: ['R13', 'R14'], features: ['tts-transport'], screenCapture: true,
    });
    const rate = { type: 'Slider', label: '朗读语速', within: tts };
    const rateValue = { type: 'Text', text: /^\d\.\d\d×$/, within: tts };
    await reveal(ui, rate, scroll, '朗读设置');
    const initialRate = ui.value(rateValue);
    if (initialRate === undefined) ui.block('当前窗口未同时暴露语速滑块与唯一的数值读数');
    await ui.slideTo('调整语速并核对新读数', rate, initialRate === '2.00×' ? .25 : .95, {
      route: 'reading', all: [rate, rateValue], none: [text(initialRate)],
    });
    await reveal(ui, action('15 分钟'), scroll, '朗读设置');
    await ui.tap('选择 15 分钟定时停止，核对选中项', action('15 分钟'), {
      route: 'reading', all: [selected(action('15 分钟'))],
    });
    await ui.tap('关闭定时以允许自动跨章', action('关闭'), { route: 'reading', all: [selected(action('关闭'))] });
    let availableVoice = true;
    for (const [field, title] of [['voice', '音色选项'], ['engine', '语音引擎'], ['language', '朗读语言'],
      ['session', '音频会话'], ['failure', '不可用处理']]) {
      const trigger = choiceRow(field);
      await reveal(ui, trigger, scroll, '音频配置');
      await ui.tap(`打开${title}并核对首帧与完整内容`, trigger, {
        route: 'reading', all: [picker, { ...text(title), within: picker }, { ...close, within: picker }],
        requiredRules: ['R9', 'R10', 'R13'], transition: surface(picker.id), filmstrip: true,
      });
      if (field === 'voice') {
        const noVoice = { text: /^当前没有可用的系统音色/, within: picker };
        const audition = { ...action(/，试听$/u), within: picker, first: true };
        if (ui.has(noVoice)) {
          availableVoice = false;
          ui.defer('原生音色试听、朗读启停与自动跨章', '当前 VM 的音色选择器回读为无可用系统音色');
        } else {
          await ui.tap('试听首个可用系统音色', audition, {
            route: 'reading', all: [picker, { ...action(/，停止试听$/u), within: picker }], screenCapture: true,
          });
        }
      }
      if (field === 'engine') {
        await ui.tap('进入在线 TTS 管理表单', { ...action('管理在线 TTS'), within: picker }, {
          route: 'reading', all: [manager, id('reader-tts-manager-form'), { ...close, within: manager }],
          requiredRules: ['R9', 'R10', 'R14'], features: ['online-tts-editor'],
          transition: surface(manager.id), filmstrip: true,
        });
        await ui.tap('关闭在线 TTS 管理表单并恢复模块输入', { ...close, within: manager }, {
          route: 'reading', all: [tts, trigger], none: [manager, picker],
        });
      } else {
        await ui.tap(`关闭${title}并恢复原配置行`, { ...close, within: picker }, {
          route: 'reading', all: [tts, trigger], none: [picker],
        });
      }
    }
    if (!availableVoice) return;
    await ui.key('退出配置并返回模块入口', 'Back', { route: 'reading', all: [entry('tts')] });
    await ui.tap('重新打开朗读播放区', entry('tts'), { route: 'reading', all: [toggle, stopDisabled] });
    await ui.tap('启动朗读并验证单所有者变身', toggle, {
      ...steadyReader(mode), all: [capsule('朗读', true)], none: [tts], transition: launch('tts'), filmstrip: true,
    });
    await togglePlayback(ui, '朗读', mode);
    await controls(ui, 'tts');
    await ui.tap('跳到下一句，核对上句恢复可用', next, {
      route: 'reading', all: [tts, previous, stop], requiredRules: ['R14'], features: ['tts-transport'],
    });
    await ui.tap('退回上一句，核对下一句可用', previous, { route: 'reading', all: [tts, next, stop] });
    const seek = { type: 'Slider', label: '跳转朗读句子', within: tts };
    await reveal(ui, seek, scroll, '朗读播放区');
    if (!ui.has(seek)) ui.block('当前章未暴露可操作的逐句定位滑块，无法在有限窗口内触发自动跨章');
    await ui.slideTo('跳至最后一句，等待真实朗读跨章且正文不闪烁', seek, 1, {
      route: 'reading', all: [tts, stop], transition: chapterAdvance('reader-chapter-local'), filmstrip: true,
    });
    await ui.tap('停止朗读，核对启用态返回不可用', stop, {
      route: 'reading', all: [toggle, stopDisabled], none: [stop],
      requiredRules: ['R14'], features: ['tts-transport'], screenCapture: true,
    });
  },

  async J10(ui) {
    const mode = await openLocalReader(ui);
    const auto = moduleId('autoPage');
    const toggle = transport('auto-page', 'toggle');
    const stop = transport('auto-page', 'stop');
    const stopDisabled = transport('auto-page', 'stop', false);
    const next = transport('auto-page', 'next');
    const previous = transport('auto-page', 'previous');
    const speed = { type: 'Slider', label: '自动翻页间隔', within: auto };
    await openReadingDirectory(ui);
    const current = ui.has(controlTitle(SECOND_LOCAL_CHAPTER)) ? THIRD_LOCAL_CHAPTER : SECOND_LOCAL_CHAPTER;
    await jumpToLocalChapter(ui, current);
    if (ui.has(entry('autoPage'))) await ui.key('关闭目录选择后的阅读控制', 'Back', steadyReader(mode));
    await controls(ui, 'autoPage');
    await ui.wait('核对自动翻页停止与启动的可用状态', {
      route: 'reading', all: [auto, toggle, stopDisabled, next], none: [stop],
      requiredRules: ['R14'], features: ['auto-page-transport'], screenCapture: true,
    });
    await reveal(ui, speed, { type: 'Scroll', within: auto }, '自动翻页模块');
    await ui.slideTo('把自动翻页间隔调到下限并回读', speed, 0, {
      route: 'reading', all: [speed, { text: '2 秒', within: auto }],
    });
    await ui.tap('启动自动翻页并采集飞行动效', toggle, {
      ...steadyReader(mode), all: [capsule('自动翻页', true)], none: [auto],
      transition: [launch('autoPage'), chapterAdvance('reader-chapter-local')], filmstrip: true,
    });
    await togglePlayback(ui, '自动翻页', mode);
    await controls(ui, 'autoPage');
    await ui.tap('从自动翻页模块切换下一章并检查保留帧', next, {
      route: 'reading', all: [auto, previous, stop], transition: chapterAdvance('reader-chapter-local'), filmstrip: true,
    });
    await ui.tap('从自动翻页模块切回上一章', previous, {
      route: 'reading', all: [auto, next, stop], transition: chapterAdvance('reader-chapter-local'),
    });
    await ui.tap('停止并核对自动翻页回到可启动状态', stop, {
      route: 'reading', all: [toggle, stopDisabled], none: [stop],
      requiredRules: ['R14'], features: ['auto-page-transport'], screenCapture: true,
    });
  },

  async J11(ui) {
    const mode = await openLocalReader(ui);
    const changedTheme = enabled(`reader-control-theme-${ui.scheme() === 'night' ? 'day' : 'night'}`);
    await controls(ui, 'appearance');
    await ui.tap('切换并核对阅读纸面主题', changedTheme, {
      route: 'reading', all: [appearance, selected(changedTheme)], requiredRules: ['R14'], features: ['reading-appearance'],
    });
    const systemFont = enabled('reader-control-font-system');
    const serifFont = enabled('reader-control-font-serif');
    await reveal(ui, serifFont, appearance, '字体列表');
    await ui.wait('核对可排序的系统与衬线字体', { route: 'reading', all: [systemFont, serifFont] });
    const originals = ui.inOrder(systemFont, serifFont) ? [systemFont, serifFont] : [serifFont, systemFont];
    const reordered = originals.slice().reverse();
    await ui.drag('按住原生字体控件并拖到另一插槽', systemFont, serifFont, {
      route: 'reading', all: [appearance], order: reordered, screenCapture: true,
    });
    await ui.key('退出外观模块以验证字体顺序继续保留', 'Back', { route: 'reading', all: [entry('appearance')] });
    await ui.tap('重新打开并定位字体列表', entry('appearance'), { route: 'reading', all: [appearance] });
    await reveal(ui, serifFont, appearance, '字体列表');
    await ui.wait('确认重新打开后新字体顺序仍保存', { route: 'reading', order: reordered });
    await ui.drag('反向拖动还原初始字体顺序', systemFont, serifFont, { route: 'reading', order: originals });
    const fontSize = action('增加字号');
    await reveal(ui, fontSize, appearance, '外观面板');
    const size = id('reader-control-appearance-metric-value-fontSize');
    const before = ui.value(size);
    const typography = { route: 'reading', all: [appearance, text('排版'), fontSize] };
    if (before === undefined) ui.block('当前窗口未暴露可复核的字号数值');
    await ui.tap('调大字号并核对原生读数更新', fontSize, { ...typography, all: [...typography.all, size], none: [text(before)] });
    await ui.tap('还原字号并核对初始读数', action('减少字号'), { ...typography, all: [...typography.all, { ...size, text: before }] });
    await ui.key('关闭外观模块', 'Back', { route: 'reading', all: [entry('settings')] });
    await ui.key('关闭阅读控制', 'Back', steadyReader(mode));
    const other = mode === 'paged' ? 'continuous' : 'paged';
    await ensureReadingMode(ui, other);
    await ensureReadingMode(ui, mode);
    await controls(ui, 'settings');
    const statusBar = { ...label(/^隐藏状态栏/u), within: readerSettings };
    await reveal(ui, statusBar, readerSettings, '阅读设置');
    const shown = ui.value(statusBar, 'selected');
    await ui.tap('切换沉浸状态栏并核对开关改变', statusBar, {
      route: 'reading', all: [{ ...statusBar, selected: shown === 'true' ? 'false' : 'true' }],
    });
    await ui.tap('恢复矩阵进入阅读时的状态栏设置', statusBar, {
      route: 'reading', all: [{ ...statusBar, selected: shown === 'true' ? 'true' : 'false' }],
    });
    await ui.key('返回亮度入口', 'Back', { route: 'reading', all: [entry('brightness')] });
    const brightness = action(/^(跟随系统亮度，已开启，点击改为手动|手动亮度，点击跟随系统)$/u);
    await ui.tap('打开亮度控制并检查当前亮度模式', entry('brightness'), { route: 'reading', all: [brightness] });
    const prior = ui.value(brightness, 'description') ?? ui.value(brightness, 'accessibilityText');
    if (!prior) ui.block('当前窗口未报告亮度方式的可访问性读数');
    await ui.tap('切换亮度控制方式并验证回读', brightness, {
      route: 'reading', all: [brightness], none: [action(prior)], screenCapture: true,
    });
    await ui.tap('恢复原亮度方式', brightness, { route: 'reading', all: [action(prior)] });
  },

  async J12(ui) {
    const mode = await openLocalReader(ui);
    await ui.tap('从正文打开阅读控制', readingStage, { route: 'reading', all: [enabled(/^reader-control-more(?:-short)?$/)] });
    const more = ui.has(enabled('reader-control-more')) ? enabled('reader-control-more') : enabled('reader-control-more-short');
    const menu = id('reader-control-more-menu');
    const bookInfo = { ...action('书籍信息'), within: menu };
    await ui.tap('打开正文更多菜单', more, { route: 'reading', all: [menu, bookInfo], requiredRules: ['R9', 'R10'] });
    await ui.tap('正文 → 书籍信息，应以 push 打开详情', bookInfo, {
      route: 'detail', all: [text(LOCAL_TXT), readBook], requiredRules: ['R8', 'R13'],
      transition: routeMotion('push', 'reader-detail'), filmstrip: true,
    });
    if (ui.environment()?.reducedMotion) {
      ui.note('侧滑取消的适用范围', '减弱动效配置关闭交互式边缘预览，继续验证系统 Back 返回');
    } else {
      await ui.cancelEdgeBack('从原生窗口边缘短滑，在提交阈值前释放', {
        route: 'detail', all: [text(LOCAL_TXT), readBook], none: [readingStage],
        transition: [routeMotion('preview', 'reader-detail'), routeMotion('cancel', 'reader-detail')], filmstrip: true,
      });
    }
    await ui.key('详情 → Back 应以 pop 恢复原正文', 'Back', {
      ...steadyReader(mode), transition: routeMotion('pop', 'reader-detail'), filmstrip: true,
    });
    await openReadingDirectory(ui);
    await ui.key('阅读目录 → 阅读控制', 'Back', { route: 'reading', all: [readerDirectory], none: [readerDirectoryContent] });
    await ui.key('阅读控制 → 原正文', 'Back', steadyReader(mode));
    await ui.key('退出本地正文返回详情', 'Back', { route: 'detail', all: [readBook] });
    await ui.key('回到书架以进入在线书正文', 'Back', bookshelfReady);
    await search(ui, SHELF_NOVEL, true);
    await ui.tap('从搜索结果打开在线书详情', searchRow(SHELF_NOVEL), {
      route: 'detail', all: [readBook, text(SHELF_NOVEL)],
    });
    await ui.tap('进入在线书的真实正文', readBook, { route: 'reading', all: [readingStage], modalOpen: false });
    const trigger = enabled(/^reader-source-trigger:.*"reader-control(?:-short)?"\]$/u);
    await ui.tap('显示在线书的换源入口', readingStage, { route: 'reading', all: [trigger] });
    await ui.tap('打开正文换源并核对正文仍在阅读路由', trigger, {
      route: 'reading', all: [switchClose], requiredRules: ['R9', 'R10'],
    });
    await ui.tap('关闭正文换源并恢复原触点', switchClose, { route: 'reading', all: [trigger], none: [switchClose] });
    await ui.key('收起换源后的阅读控制', 'Back', { route: 'reading', all: [readingStage], none: [trigger] });
    await ui.key('回到在线书详情', 'Back', { route: 'detail', all: [readBook] });
    await ui.key('回到搜索', 'Back', { route: 'search', all: [searchField] });
    await ui.key('回到书架', 'Back', bookshelfReady);
    await openSettings(ui);
    await openLicenses(ui);
  },

  async J13(ui) {
    await openSettings(ui);
    const source = id('reader-source-content');
    const groups = id('reader-source-v9-groups');
    const imports = id('reader-source-v9-import');
    const more = label('书源管理更多操作');
    const sourceName = text(/^ReaderNovel[AB]$/u);
    await ui.tap('进入书源管理，核对公开书源', enabled('reader-settings-source-management'), {
      route: 'source', all: [source, sourceName, more], requiredRules: ['R8', 'R13'],
    });
    await ui.tap('展开书源分组选择器', enabled('reader-source-group-trigger'), {
      route: 'source', all: [id('reader-source-group-panel'), id('reader-source-group-search')],
      requiredRules: ['R9', 'R10', 'R14'], features: ['source-group-select'],
    });
    await ui.key('收起分组选择器并恢复源列表', 'Back', { route: 'source', all: [source, more] });
    const manage = enabled('reader-source-v9-open-groups');
    await ui.tap('打开书源更多操作', more, { route: 'source', all: [manage] });
    await ui.tap('进入分组管理', manage, {
      route: 'source', all: [groups, text('分组管理'), enabled('reader-source-v9-group-create')],
      transition: routeMotion('push', 'source-groups'), filmstrip: true,
    });
    const ungrouped = enabled('reader-source-v9-group-row-ungrouped');
    await ui.tap('核对未分组公开书源的真实成员', ungrouped, {
      route: 'source', all: [groups, sourceName], transition: routeMotion('push', 'source-group-detail'),
    });
    await ui.key('从分组详情返回分组页', 'Back', {
      route: 'source', all: [ungrouped], transition: routeMotion('pop', 'source-group-detail'),
    });
    await ui.key('从分组管理返回列表', 'Back', {
      route: 'source', all: [source, more], transition: routeMotion('pop', 'source-groups'), filmstrip: true,
    });
    const importEntry = enabled(/:import:footer$/u);
    await ui.tap('进入 V9 导入来源与解析步骤', importEntry, {
      route: 'source', all: [imports, text('导入书源'), id('reader-source-v9-import-origin'), enabled('reader-source-v9-import-file')],
      transition: routeMotion('push', 'source-import'), filmstrip: true,
    });
    const online = label('在线链接');
    const urlField = { type: 'TextInput', label: '书源链接', within: imports };
    const parse = enabled('reader-source-v9-import-parse');
    const review = id('reader-source-v9-import-review');
    const importedSource = 'ReaderJourneyImportV9';
    await ui.tap('选择在线链接导入', online, { route: 'source', all: [imports, urlField], none: [parse] });
    await ui.inputSourceUrl('填写限定的公开 V9 样本链接', urlField, { route: 'source', all: [urlField] });
    if (!ui.has(parse)) {
      await ui.key('结束链接编辑并恢复下一步', 'Back', { route: 'source', all: [imports, parse] });
    }
    const commit = enabled('reader-source-v9-import-commit');
    await ui.tap('经原业务解析并核对独立样本的预览', parse, {
      route: 'source', all: [review, text('静态校验 · 共 1 项'), commit],
      requiredRules: ['R12', 'R14'], features: ['source-v9-import-review'], screenCapture: true,
    });
    await ui.tap('提交独立样本，核对导入结果', commit, {
      route: 'source', all: [id('reader-source-v9-import-result'), enabled('reader-source-v9-import-return')],
      none: [commit], screenCapture: true,
    });
    await ui.tap('回到书源列表并等待新源读取完成', enabled('reader-source-v9-import-return'), {
      route: 'source', all: [source, more, sourceName, text(importedSource)], none: [imports],
      transition: routeMotion('pop', 'source-import'), filmstrip: true,
    });
    const check = action(new RegExp(`^${importedSource}，检测，`, 'u'));
    await ui.tap('打开新导入书源的检测', check, {
      route: 'source', all: [text('书源检测报告'), text(importedSource)], requiredRules: ['R9', 'R10'],
    });
    const checkStart = action('开始检测');
    if (ui.has(checkStart)) {
      await ui.tap('仅检测受控公开样本并核对状态', checkStart, {
        route: 'source', all: [action('重新检测')], none: [checkStart], screenCapture: true,
      });
    } else {
      ui.defer('触发新源的可用性检测', '当前检测面板未暴露启用的开始检测按钮');
    }
    await ui.key('关闭检测面板，保留导入源', 'Back', { route: 'source', all: [source, text(importedSource)] });
    const switchSource = { type: 'Toggle', label: `${importedSource}，启用书源`, enabled: 'true' };
    const original = ui.value(switchSource, 'checked') ?? ui.value(switchSource, 'selected');
    const state = ui.value(switchSource, 'checked') === undefined ? 'selected' : 'checked';
    if (!['true', 'false'].includes(String(original))) ui.block('导入源未提供可验证的原生启用状态');
    const reversed = String(original) === 'true' ? 'false' : 'true';
    await ui.tap('切换新源启用状态并等待写入回读', switchSource, { route: 'source', all: [{ ...switchSource, [state]: reversed }] });
    await ui.tap('恢复新源原启用状态', switchSource, { route: 'source', all: [{ ...switchSource, [state]: original }] });
    const item = action(importedSource);
    const remove = id('reader-source-batch-delete');
    await ui.tap('进入批量管理以仅选择测试样本', action('批量管理'), { route: 'source', all: [item, remove] });
    await ui.tap('选定独立样本', item, { route: 'source', all: [selected(item), enabled(remove.id)] });
    await ui.tap('打开删除确认，要求只有一个公开样本', enabled(remove.id), {
      route: 'source', all: [text(/^确定删除所选 1 个书源/u), action('删除')], requiredRules: ['R9', 'R10'],
    });
    await ui.tap('删除独立样本并核对原始书源仍保留', action('删除'), {
      route: 'source', all: [source, sourceName], none: [item, text(importedSource)],
    });
  },

  async J14(ui) {
    const mode = await openLocalReader(ui);
    const selection = { text: /[^\s]{8,}/u, type: 'Text',
      within: [mode === 'paged' ? activePage : stageMode(mode)], first: true };
    if (ui.has(selection)) {
      await ui.longPress('长按已绘制正文以核对原生选文菜单', selection, {
        route: 'reading', all: [{ text: '复制' }, { text: '分享' }], screenCapture: true,
      });
      await ui.share('从原生选文菜单打开系统分享并返回正文', { text: '分享' }, {
        ...steadyReader(mode), none: [text('复制')],
      });
    } else {
      ui.defer('选中文本并核对原生操作菜单', '当前正文未向远端布局转储暴露可操作段落');
    }
    await ui.key('退出正文，核对书籍分享入口', 'Back', { route: 'detail', all: [readBook] });
    const copy = enabled('reader-detail-share-copy');
    await reveal(ui, copy, { type: 'Scroll' }, '本地详情');
    await ui.wait('核对书籍信息、复制及原文件分享入口', {
      route: 'detail', all: [enabled('reader-detail-share-book'), copy, enabled('reader-detail-share-file')], screenCapture: true,
    });
    await ui.share('打开并从原生分享面板返回详情', enabled('reader-detail-share-book'), { route: 'detail', all: [readBook] });
    await ui.key('离开详情返回书架', 'Back', bookshelfReady);
    await openSettings(ui);
    const backup = label('本地备份与恢复');
    const exportAction = label('导出恢复包');
    const restoreAction = label('导入恢复包');
    const passphrase = { type: 'TextInput', label: '恢复包口令' };
    const repeated = { type: 'TextInput', label: '再次输入恢复包口令' };
    const exportConfirm = action('确认导出');
    const inspectConfirm = action('选择恢复包');
    const credentials = 'ReaderPublicJourney14';
    const openBackup = { route: 'settings', all: [exportAction, restoreAction] };
    await reveal(ui, backup, settingsScroll, '设置首页');
    await ui.tap('打开本地备份与恢复', backup, { route: 'settings', all: [exportAction, restoreAction] });
    await ui.tap('核对加密导出要求双份口令且空口令不可提交', exportAction, {
      route: 'settings', all: [passphrase, repeated, action('取消')], none: [exportConfirm],
      requiredRules: ['R9', 'R10'], transition: surface('dialog'), filmstrip: true,
    });
    await ui.input('输入固定公开夹具口令', passphrase, credentials, {
      route: 'settings', all: [repeated], none: [exportConfirm],
    });
    await ui.input('复输口令后仅允许确认导出', repeated, credentials, { route: 'settings', all: [exportConfirm] });
    await ui.tap('导出真实加密归档，核对回读结果', exportConfirm, {
      ...openBackup, all: [restoreAction, text(/^恢复包已导出。/u)], screenCapture: true,
    });
    await ui.tap('核对导入要求口令后才开放文件选择', restoreAction, {
      route: 'settings', all: [passphrase, action('取消')], none: [inspectConfirm], requiredRules: ['R9', 'R10'],
    });
    await ui.input('输入不同的公开口令用于校验失败', passphrase, 'ReaderPublicWrong14', { route: 'settings', all: [inspectConfirm] });
    await ui.tap('拒绝错误口令，禁止进入恢复预览', inspectConfirm, {
      ...openBackup, all: [restoreAction, text('恢复包未通过校验，请核对口令与文件完整性。')],
      none: [text('恢复包校验完成')], screenCapture: true,
    });
    await ui.key('从备份页回到设置首页', 'Back', settingsHome);
    await ui.tap('打开书架以建立恢复前差异', tab('bookshelf'), bookshelfReady);
    await search(ui, NEW_NOVEL, false);
    await ui.tap('打开归档时尚未入架的公开样本', searchRow(NEW_NOVEL), { route: 'detail', all: [addBook] });
    await ui.tap('归档后将公开样本加入书架', addBook, { route: 'detail', all: [removeBook], none: [addBook] });
    await ui.key('返回搜索并核对归档后的新状态', 'Back', {
      route: 'search', all: [{ ...text('已在书架'), within: searchRow(NEW_NOVEL) }],
    });
    await ui.key('返回有新增样本的书架', 'Back', { ...bookshelfReady, all: [...bookshelfReady.all, text(NEW_NOVEL)] });
    await openSettings(ui);
    await reveal(ui, backup, settingsScroll, '设置首页');
    await ui.tap('重新打开本地备份与恢复', backup, openBackup);
    await ui.tap('重新选择同一隔离归档', restoreAction, { route: 'settings', all: [passphrase] });
    await ui.input('输入正确口令到原生密码字段', passphrase, credentials, { route: 'settings', all: [inspectConfirm] });
    await ui.tap('核对正确口令能完成真实归档检验', inspectConfirm, {
      route: 'settings', all: [text('恢复包校验完成'), action('恢复…')], screenCapture: true,
    });
    const restoreConfirm = action('确认恢复');
    await ui.tap('恢复预览 → 核对替换警告', action('恢复…'), {
      route: 'settings', all: [text('恢复本地阅读库'), restoreConfirm], requiredRules: ['R9', 'R10'],
    });
    await ui.tap('应用隔离备份并核对恢复完成回执', restoreConfirm, {
      ...openBackup, all: [restoreAction, text(/^阅读库已恢复。/u)], screenCapture: true,
    });
    await ui.key('从恢复页返回设置首页', 'Back', settingsHome);
    await ui.tap('核对恢复后的书架已撤销归档后新增书', tab('bookshelf'), {
      ...bookshelfReady, all: [...bookshelfReady.all, text(SHELF_NOVEL)], none: [text(NEW_NOVEL)],
    });
    await ui.openInvalidBook('通过原生系统打开队列拒绝异常 EPUB', {
      route: 'bookshelf', all: [text('文件损坏或格式不支持，请换文件')], none: [readingStage], screenCapture: true,
    });
    await ui.wait('异常文件没有新增条目或开启阅读', {
      ...bookshelfReady, none: [readingStage, text(NEW_NOVEL)],
    });
    ui.externalCoverage('系统备份文档提供方的界面与授权', '本旅程把真实恢复包绑定到隔离 VM 夹具的文档路径');
    ui.externalCoverage('系统分享接收方完成交付', '本旅程只在真正的系统分享面板上验证打开与取消');
  },
};
