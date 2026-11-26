const SHELF_NOVEL = 'ReaderShelfNovel';
const NEW_NOVEL = 'ReaderNewNovel';
const COMIC = 'ReaderComic';
const LOCAL_TXT = 'Reader Phase 1 公共长目录';
const FIRST_REMOTE_CHAPTER = '第一章 启程';
const SECOND_REMOTE_CHAPTER = '第二章 校验';
const SECOND_LOCAL_CHAPTER = '第二章 测试编号 02';

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
const switchClose = { id: /^reader-source-close:/, enabled: 'true' };
const addBook = { id: 'reader-detail-shelf-action:加入书架', enabled: 'true' };
const removeBook = { id: 'reader-detail-shelf-action:移除书架', enabled: 'true' };
const readBook = { id: 'reader-detail-primary-action', enabled: 'true' };
const shelfRowNovelMore = { id: /^reader-shelf-book-action:.*ReaderShelfNovel",true\]$/, enabled: 'true' };
const shelfRowLocalMore = { id: /^reader-shelf-book-action:.*,"local",.*true\]$/, enabled: 'true' };

function searchRow(title) {
  return { id: new RegExp(`^reader-search-result:.*${title.toLowerCase()}`), enabled: 'true' };
}

async function coldShelf(ui) {
  await ui.wait('冷启动后显示本地与在线书架条目', {
    route: 'bookshelf', all: [searchEntry, text(SHELF_NOVEL), text(LOCAL_TXT)], modalOpen: false,
  });
}

async function search(ui, title, inBookshelf) {
  await ui.tap('打开书架搜索', searchEntry, { route: 'search', all: [searchField] });
  await ui.input(`填写书名 ${title}`, searchField, title, { route: 'search', all: [searchField] });
  await ui.tap(`执行搜索 ${title}`, searchSubmit, {
    route: 'search', all: [searchRow(title), text(title)],
  });
  const membershipBadge = { ...text('已在书架'), within: searchRow(title) };
  await ui.wait(`核对 ${title} 的搜索结果归属`, {
    route: 'search', all: inBookshelf ? [searchRow(title), membershipBadge] : [searchRow(title)],
    none: inBookshelf ? [] : [membershipBadge],
  });
}

async function openShelfMore(ui) {
  await ui.tap('打开书架更多抽屉', shelfMore, {
    route: 'bookshelf', all: [shelfMoreSheet, text('书架操作'), downloadManagement], modalOpen: true,
  });
}

export const journeys = {
  async J1(ui) {
    await coldShelf(ui);
    await ui.tap('切换封面模式', viewCover, {
      route: 'bookshelf', all: [text(LOCAL_TXT), text(SHELF_NOVEL)], none: [shelfRowNovelMore],
    });
    await ui.tap('切换列表模式', viewList, {
      route: 'bookshelf', all: [shelfRowNovelMore, shelfRowLocalMore],
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
  },

  async J2(ui) {
    await coldShelf(ui);
    await search(ui, SHELF_NOVEL, true);
    await ui.tap('从已入架的搜索结果打开详情', searchRow(SHELF_NOVEL), {
      route: 'detail', all: [text(SHELF_NOVEL), sourceA, removeBook, switchSource],
    });
    await ui.tap('打开详情换源抽屉', switchSource, {
      route: 'detail', all: [switchClose], modalOpen: true,
    });
    await ui.tap('关闭换源并验证详情动作恢复', switchClose, {
      route: 'detail', all: [removeBook, switchSource], none: [switchClose], modalOpen: false,
    });
    const alternative = { type: 'Text', text: /^(ReaderNovelB|https:\/\/novel-b\.reader-journeys\.invalid)$/ };
    await ui.tap('重新打开换源并等待可用备选', switchSource, {
      route: 'detail', all: [switchClose, alternative], modalOpen: true,
    });
    await ui.tap('切换到 ReaderNovelB 并进入阅读', alternative, {
      route: 'reading', all: [readingStage, id(/^reader-source-trigger:.*novel-b\.reader-journeys\.invalid.*"reader-body"\]$/)],
      none: [switchClose], modalOpen: false,
    });
    await ui.key('从切源后的阅读返回详情', 'Back', {
      route: 'detail', all: [text(SHELF_NOVEL), sourceB, removeBook, switchSource], modalOpen: false,
    });
    await ui.key('返回搜索并核对新源仍对应在架书籍', 'Back', {
      route: 'search', all: [{ ...text('已在书架'), within: searchRow(SHELF_NOVEL) }],
    });
  },

  async J3(ui) {
    await coldShelf(ui);
    await search(ui, NEW_NOVEL, false);
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
    await ui.tap('切到书架列表以访问本地书操作', viewList, {
      route: 'bookshelf', all: [shelfRowLocalMore],
    });
    const bookActions = id('reader-bookshelf-book-action-sheet');
    const bookInfo = { id: /^reader-bookshelf-book-action-.*::book-info$/, enabled: 'true', within: bookActions };
    await ui.tap('打开本地书操作抽屉', shelfRowLocalMore, {
      route: 'bookshelf', all: [bookActions, bookInfo], modalOpen: true,
    });
    await ui.tap('打开已导入 TXT 的书籍信息', bookInfo, {
      route: 'detail', all: [text(LOCAL_TXT), text('本地藏书'), readBook], modalOpen: false,
    });
    await ui.tap('进入本地 TXT 阅读', readBook, { route: 'reading', all: [readingStage] });
    await ui.swipe('左滑翻页', readingStage, 'left', { route: 'reading', all: [readingStage] });
    await ui.tap('打开阅读控制并显示目录入口', readingStage, {
      route: 'reading', all: [readerDirectory],
    });
    const secondChapter = { text: SECOND_LOCAL_CHAPTER, within: readerDirectoryContent };
    await ui.tap('打开阅读控制中的目录', readerDirectory, {
      route: 'reading', all: [readerDirectoryContent, secondChapter],
    });
    await ui.tap('选择本地 TXT 的第二章', secondChapter, {
      route: 'reading', all: [readingStage], none: [readerDirectoryContent],
    });
    await ui.tap('显示控制并核对当前章已变化', readingStage, {
      route: 'reading', all: [text(SECOND_LOCAL_CHAPTER), readerDirectory],
    });
    await ui.tap('关闭本地阅读控制', readingStage, {
      route: 'reading', all: [readingStage], none: [readerDirectory],
    });
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
      route: 'downloads', all: [text('下载管理'), novelRow, downloadFilter], modalOpen: false,
    });
    await ui.tap('打开下载状态筛选', downloadFilter, {
      route: 'downloads', all: [text('筛选'), text('全部状态')], modalOpen: true,
    });
    await ui.key('关闭下载筛选后恢复列表交互', 'Back', {
      route: 'downloads', all: [novelRow, downloadFilter], none: [text('全部状态')], modalOpen: false,
    });
    await ui.tap('打开在线小说的章节下载列表', novelRow, {
      route: 'downloads', all: [text('章节下载'), text(FIRST_REMOTE_CHAPTER), text(SECOND_REMOTE_CHAPTER)],
    });
    const secondChapterActions = { id: /^reader-download:chapter-menu:.*\/chapter\/2/, enabled: 'true' };
    const downloadChapter = id('reader-download:sheet-action:download');
    await ui.tap('打开第二章操作', secondChapterActions, {
      route: 'downloads', all: [text(/^章节操作 · 已选 1/), downloadChapter], modalOpen: true,
    });
    await ui.tap('下载第二章并等待已保存的章节状态', downloadChapter, {
      route: 'downloads', all: [text(SECOND_REMOTE_CHAPTER), text(/^正文已保存/),
        { id: /chapter-reading:.*\/chapter\/2.*"action"\]$/, enabled: 'true' }], modalOpen: false,
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
      route: 'reading', all: [mangaSwitch, { type: 'Slider', within: mangaStage }],
    });
    await ui.tap('打开漫画换源抽屉并等待候选来源', mangaSwitch, {
      route: 'reading', all: [switchClose, text(/^(ReaderComic[AB]|https:\/\/comic-[ab]\.reader-journeys\.invalid)$/)], modalOpen: true,
    });
    await ui.tap('关闭漫画换源抽屉并恢复原阅读工具栏', switchClose, {
      route: 'reading', all: [mangaStage, mangaSwitch], none: [switchClose], modalOpen: false,
    });
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
      route: 'settings', all: [text('通用设置'), id('reader-settings-source-management')],
    });
    await ui.tap('打开书源管理并核对已导入的书源', id('reader-settings-source-management'), {
      route: 'source', all: [text('书源管理'), id('reader-source-content'), text(/^ReaderNovel[AB]$/)],
    });
    await ui.key('从书源管理返回设置', 'Back', {
      route: 'settings', all: [id('reader-settings-source-management'), tab('bookshelf')],
    });
    await ui.tap('切回书架并核对原条目', tab('bookshelf'), {
      route: 'bookshelf', all: [searchEntry, text(SHELF_NOVEL), text(LOCAL_TXT)],
    });
  },
};
