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
const switchClose = { id: /^reader-source-close:/, enabled: 'true' };
const addBook = { id: 'reader-detail-shelf-action:加入书架', enabled: 'true' };
const removeBook = { id: 'reader-detail-shelf-action:移除书架', enabled: 'true' };
const readBook = { id: 'reader-detail-primary-action', enabled: 'true' };
const shelfRowNovelMore = { id: /^reader-shelf-book-action:.*ReaderShelfNovel",true\]$/, enabled: 'true' };
const shelfRowLocalMore = { id: /^reader-shelf-book-action:.*,"local",.*true\]$/, enabled: 'true' };
const bookActions = id('reader-bookshelf-book-action-sheet');
const bookInfo = { id: /^reader-bookshelf-book-action-.*::book-info$/, enabled: 'true', within: bookActions };
const activePage = { id: /^reader-page-slot-[ab]$/, enabled: 'true' };

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

async function openLocalDetail(ui) {
  if (!ui.has(shelfRowLocalMore)) {
    await ui.tap('切到书架列表以访问本地书操作', viewList, {
      route: 'bookshelf', all: [shelfRowLocalMore],
    });
  }
  await ui.tap('打开本地书操作抽屉', shelfRowLocalMore, {
    route: 'bookshelf', all: [bookActions, bookInfo], modalOpen: true,
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
      route: 'bookshelf', all: [shelfRowNovelMore, shelfRowLocalMore], screenCapture: true,
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
      route: 'detail', all: [removeBook, switchSource], none: [switchClose], modalOpen: false, screenCapture: true,
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
    await ui.key('从切源后的阅读返回详情', 'Back', {
      route: 'detail', all: [text(SHELF_NOVEL), sourceB, removeBook, switchSource], modalOpen: false,
    });
    await ui.key('返回搜索并核对新源仍对应在架书籍', 'Back', {
      route: 'search', all: [{ ...text('已在书架'), within: searchRow(SHELF_NOVEL) }],
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
    await openLocalDetail(ui);
    const pageA = { id: 'reader-page-slot-a', enabled: 'true' };
    const pageB = { id: 'reader-page-slot-b', enabled: 'true' };
    await ui.tap('进入本地 TXT 阅读', readBook, { route: 'reading', all: [readingStage, activePage] });
    const [beforeSwipe, afterSwipe] = ui.has(pageA) ? [pageA, pageB] : [pageB, pageA];
    await ui.swipe('左滑翻页并核对绘制页面切换', readingStage, 'left', {
      route: 'reading', all: [readingStage, afterSwipe], none: [beforeSwipe], screenCapture: true,
    });
    await ui.tap('打开阅读控制并显示目录入口', readingStage, {
      route: 'reading', all: [readerDirectory],
    });
    const activeDirectoryTab = { id: 'reader-control-directory-tab-directory', enabled: 'true' };
    const chooseChapter = title => ({ text: title, within: [readerDirectoryContent, { type: 'ListItem' }] });
    const controlTitle = title => ({ text: `${title} · 本地书籍`, within: id('reader-control-motion-topbar') });
    await ui.tap('打开阅读控制中的目录', readerDirectory, {
      route: 'reading', all: [activeDirectoryTab, chooseChapter(SECOND_LOCAL_CHAPTER), chooseChapter(THIRD_LOCAL_CHAPTER)], screenCapture: true,
    });
    const target = ui.has(controlTitle(SECOND_LOCAL_CHAPTER)) ? THIRD_LOCAL_CHAPTER : SECOND_LOCAL_CHAPTER;
    await ui.tap(`从目录跳到 ${target} 并核对阅读内容`, chooseChapter(target), {
      route: 'reading', all: [readingStage, controlTitle(target), { text: target, within: [activePage, { type: 'CustomFrameNode' }] }],
      none: [activeDirectoryTab],
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
      route: 'downloads', all: [text('下载管理'), novelRow, downloadFilter], modalOpen: false, screenCapture: true,
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
      route: 'downloads', all: [text(SECOND_REMOTE_CHAPTER), savedChapter], modalOpen: false,
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
      route: 'settings', all: [text('通用设置'), id('reader-settings-source-management')], screenCapture: true,
    });
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
    await ui.tap('打开搜索以核对无结果态', searchEntry, { route: 'search', all: [searchField] });
    await ui.input('填写公开无匹配关键词', searchField, NO_MATCH, { route: 'search', all: [searchField] });
    await ui.tap('提交搜索并核对无结果态', searchSubmit, {
      route: 'search', all: [text('没有找到相关书籍'), text(`已搜索 0 个书源,未找到「${NO_MATCH}」的相关结果`)],
      none: [id(/^reader-search-result:/)], requiredRules: ['R7'], screenCapture: true,
    });
    await ui.key('从无结果态返回书架', 'Back', localShelf);

    await openLocalDetail(ui);
    await ui.tap('打开本地 TXT 并等待分页正文', readBook, { route: 'reading', all: [readingStage, activePage] });
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
      route: 'reading', all: [readingStage, activePage, id('reader-reading-interaction-host-paged')],
      none: [appearanceEntry, appearance], modalOpen: false, scheme: 'night', requiredRules: ['R5', 'R6'], screenCapture: true,
    });
    await ui.key('返回夜间详情并核对本地书动作', 'Back', {
      route: 'detail', all: [text(LOCAL_TXT), readBook], modalOpen: false, scheme: 'night', requiredRules: ['R7'],
    });
    await ui.key('返回夜间书架并核对原条目', 'Back', {
      ...localShelf, scheme: 'night', requiredRules: ['R7'],
    });
    const general = { id: 'reader-settings-general', enabled: 'true' };
    const day = action('浅色');
    await ui.tap('打开夜间设置首页', tab('settings'), {
      route: 'settings', all: [general], modalOpen: false, scheme: 'night',
    });
    await ui.tap('进入夜间通用设置核对主题控件', general, {
      route: 'settings', all: [text('App主题'), day, { ...action('深色'), selected: 'true' }],
      modalOpen: false, scheme: 'night', screenCapture: true,
    });
    await ui.tap('切回日间并核对通用设置恢复', day, {
      route: 'settings', all: [text('App主题'), { ...day, selected: 'true' }], modalOpen: false, scheme: 'day',
    });
  },
};
