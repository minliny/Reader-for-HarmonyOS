import { esc, icon, fixtures } from './shared.mjs';
import { coverImage } from './ui-library.mjs';

// SourceSwitchWindow.ets owns a full-screen retained picker, including the
// discovery/selection/failure states; its state does not replace the list.
export const sourceSwitchRendererSources = [
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:78},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:184},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:333},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:364},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:386},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:410},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:432},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:471},
  {path:'entry/src/main/ets/features/source/SourceSwitchWindow.ets',line:486},
  {path:'entry/src/main/ets/features/bookshelf/NoCoverCover.ets',line:20},
  {path:'entry/src/main/ets/pages/Index.ets',line:5017},
];

const choice = (ctx, key, fallback) => ctx.choices?.[key] ?? fallback;
const hint = text => `hint:${text}`;

function currentChapter(ctx) {
  const index = ctx.choices?.['reader-chapter-index'];
  if (index !== undefined) {
    const chapters = ctx.book?.content === 'manga' ?
      ['第1话 清晨','第2话 林间','第3话 山路','第4话 远村','第5话 灯火'] : fixtures.chapters;
    return chapters[Math.max(0,Math.min(chapters.length - 1,Number(index)))];
  }
  return ctx.book?.chapter || (ctx.book?.content === 'manga' ? '第3话 山路' : fixtures.chapter);
}

function noCover() {
  return '<div class="source-picker-cover source-picker-no-cover" role="img" aria-label="暂无封面"><span class="source-cover-rule first"></span><span class="source-cover-label">暂无封面</span><span class="source-cover-rule last"></span></div>';
}

function retainedCandidates(ctx, variant) {
  if (variant === 'empty' || variant === 'discovery-error' || variant === 'discovering') return [];
  const latestChapter = ctx.book?.latestChapter ?? ctx.book?.chapter ?? '';
  return Array.from({length:8}, (_, i) => ({
    index:i, name:i === 0 ? ctx.book?.source || fixtures.source : `书源 ${i + 1}`,
    current:i === 0, latency:27 + i * 21,
    status:i === 3 ? 'offline' : i === 5 ? 'timeout' : 'available',
    chapter:latestChapter || '暂无最新章节',
  }));
}

// Three user-requested novel concepts share mock data, not a new source backend.
const novelConceptCandidates = [
  {index:1,name:'松间书屋',chapter:'第五章 灯火',latency:240,status:'available'},
  {index:2,name:'云海阅读',chapter:'第五章 灯火',latency:330,status:'available'},
  {index:3,name:'远山书库',chapter:'第四章 远村',latency:510,status:'available'},
  {index:4,name:'青叶书坊',chapter:'第五章 灯火',latency:680,status:'available'},
  {index:5,name:'月下藏书',chapter:'',status:'unknown'},
  {index:6,name:'溪流阅读',chapter:'第四章 远村',status:'offline'},
  {index:7,name:'南风书库',chapter:'',status:'timeout'},
];

function renderNovelSourceConcept(ctx) {
  const variant = ctx.variant || 'candidates';
  const requested = choice(ctx,'source-design','direct');
  const design = ['direct','confirm','grouped'].includes(requested) ? requested : 'direct';
  const busy = variant === 'switching';
  const transaction = variant === 'failure-transaction';
  const reconcile = variant === 'failure' && choice(ctx,'source-confirmation','unknown') === 'unknown';
  const failed = ['failure','failure-transaction','discovery-error'].includes(variant);
  const mode = choice(ctx,'source-discovery-mode',variant === 'discovering' ? 'sweeping' : 'complete');
  const sweeping = mode === 'sweeping' && ['candidates','discovering'].includes(variant);
  const stopped = mode === 'stopped' && ['candidates','empty','discovering'].includes(variant);
  const source = ctx.book?.source || fixtures.source;
  const candidates = ['empty','discovery-error','discovering'].includes(variant) ? [] :
    novelConceptCandidates.filter(candidate => candidate.name !== source);
  const selectedIndex = Number(choice(ctx,'source-selected-index',busy ? 1 : -1));
  const selected = candidates.find(candidate => candidate.index === selectedIndex);
  const count = candidates.length;
  const status = sweeping ? `正在查找 · 已发现 ${count} 个书源` : busy ? '正在切换书源…' :
    transaction ? '换源失败' : reconcile ? '换源结果未确认' : variant === 'failure' ? '换源失败' :
    variant === 'discovery-error' ? '查找失败' : stopped ? `已停止 · 保留 ${count} 个书源` : `找到 ${count} 个书源`;
  const title = ctx.book?.title || fixtures.title;
  const author = ctx.book ? ctx.book.author || '未知作者' : fixtures.author;
  const latest = ctx.book?.latestChapter ?? ctx.book?.chapter ?? '';
  const latestText = latest || '最新章节待解析';
  const coverUrl = ctx.book?.coverUrl || ctx.book?.cover || '';
  const bookCover = coverImage({...ctx.book,title,cover:coverUrl},48,72,6);
  const context = `<div class="source-picker-book novel">${bookCover}<div class="lib-list-details source-picker-book-details"><div class="lib-list-title-row"><h3 title="${esc(title)}">${esc(title)}</h3></div><p title="${esc(author)}">${esc(author)}</p><small title="${esc(`最新：${latestText}`)}">${latest ? '最新：' : ''}${esc(latestText)}</small><small title="${esc(`当前书源：${source}`)}">当前书源：${esc(source)}</small></div></div>`;
  const row = candidate => {
    const switching = busy && candidate.index === selectedIndex;
    const probing = sweeping || choice(ctx,`source-row-retry-${candidate.index}`,false) === true;
    const state = switching ? 'switching' : probing ? 'probing' : candidate.status;
    const problem = candidate.status === 'offline' || candidate.status === 'timeout';
    const stateLabel = switching ? '切换中' : probing ? '重测中' :
      candidate.status === 'offline' ? '读取失败' : candidate.status === 'timeout' ? '超时' :
      candidate.status === 'unknown' ? '待检测' : '';
    const chapter = candidate.chapter || '最新章节待解析';
    const label = `${candidate.name}，${candidate.chapter ? '最新章节：' : ''}${chapter}，${stateLabel || `搜索耗时 ${candidate.latency} 毫秒`}`;
    const body = `<span class="source-picker-row-main"><span class="source-picker-title"><strong title="${esc(candidate.name)}">${esc(candidate.name)}</strong></span><span class="source-picker-chapter">${candidate.chapter ? '<span>最新</span>' : ''}<small title="${esc(chapter)}">${esc(chapter)}</small></span></span>`;
    const meta = `<span class="source-picker-latency" data-probe-state="${state}" title="${esc(stateLabel || `搜索请求耗时 ${candidate.latency} 毫秒，不代表正文读取速度`)}">${stateLabel ? `<span>${stateLabel}</span>` : `<b>${candidate.latency}</b><small> ms</small>`}</span>`;
    const disabled = variant !== 'candidates';
    const classes = `source-picker-row ${switching ? 'switching' : ''} ${design === 'confirm' && candidate.index === selectedIndex ? 'selected' : ''}`;
    if(design === 'confirm') {
      return `<label class="${classes}" data-source-kind="${candidate.status}"><input type="radio" name="source-target" value="${candidate.index}" data-choice="source-selected-index" data-render-choice="true" aria-label="${esc(label)}" ${candidate.index === selectedIndex ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${body}${meta}</label>`;
    }
    const attrs = `aria-label="${esc(label)}" data-source-kind="${candidate.status}" data-choice="source-selected-index" data-choice-value="${candidate.index}" data-action="variant:switching" ${disabled ? 'disabled' : ''}`;
    if(design === 'grouped' && problem) {
      return `<div class="${classes} source-picker-retry-row" data-source-kind="${candidate.status}"><button class="source-picker-row-select" ${attrs}>${body}</button>${meta}<button class="source-picker-retry" aria-label="重试 ${esc(candidate.name)}" data-choice="source-row-retry-${candidate.index}" data-choice-value="true" data-action-note="演示该书源的重测状态，章节与列表保留；预览不执行网络请求。" ${disabled || probing || switching ? 'disabled' : ''}>${probing ? '重测中' : '重试'}</button></div>`;
    }
    return `<button class="${classes}" ${attrs}>${body}${meta}<span class="source-picker-chevron" aria-hidden="true">${icon('reader_chevron_right',12)}</span></button>`;
  };
  let rows;
  if(design === 'grouped' && count) {
    const ordinary = candidates.filter(candidate => !['offline','timeout'].includes(candidate.status));
    const retry = candidates.filter(candidate => ['offline','timeout'].includes(candidate.status));
    rows = `<div class="source-picker-group-title"><strong>查找结果 · ${ordinary.length}</strong><small>搜索耗时</small></div>${ordinary.map(row).join('')}${retry.length ? `<div class="source-picker-group-title retry"><strong>待重试 · ${retry.length}</strong></div>${retry.map(row).join('')}` : ''}`;
  } else {
    rows = `<div class="source-picker-list" ${design === 'confirm' ? 'role="radiogroup" aria-label="选择目标书源"' : ''}>${candidates.map(row).join('')}</div>`;
  }
  const discovery = `<div class="source-picker-discovery"><div>${sweeping ? '<span class="source-picker-spinner active" aria-hidden="true"></span>' : ''}<span>${esc(design === 'confirm' && !busy && !failed && !sweeping && !stopped ? `选择目标书源 · ${count}` : status)}</span>${design !== 'grouped' || !count ? '<small>搜索耗时</small>' : ''}</div></div>`;
  const empty = !count ? `<div class="source-picker-empty"><strong>${esc(sweeping ? '正在查找其他书源…' : variant === 'empty' && !stopped ? '未找到其他书源' : status)}</strong><small>${sweeping ? '找到后会陆续显示' : '可重新查找，或返回继续阅读'}</small></div>` : '';
  const error = choice(ctx,'source-error-message',variant === 'discovery-error' ? '当前书源暂时无法查找，请重试。' : transaction ? '换源事务未完成，请撤销切换后继续。' : reconcile ? '换源结果尚未确认，请重新核对。' : '目标书源暂时无法读取，请重试。');
  const recoveryLabel = transaction ? '撤销切换' : reconcile ? '重试核对' : '重试';
  const recovery = failed ? `<footer class="source-picker-recovery"><p>${esc(error)}</p><button data-action="${esc(hint(transaction ? '按原transactionId撤销，真实完成才恢复阅读。' : reconcile ? '核对原换源回执，不重复未知提交。' : '沿原换源scope重试并保留书籍和已发现候选。'))}">${recoveryLabel}</button></footer>` : '';
  const confirm = design === 'confirm' && count ? `<footer class="source-picker-confirm"><small>${selected ? `已选：${esc(selected.name)}` : '请选择一个目标书源'}</small><button data-action="variant:switching" ${!selected || variant !== 'candidates' ? 'disabled' : ''}>${busy ? '正在切换…' : '切换到此书源'}</button></footer>` : '';
  return `<section class="source-picker source-picker-concept" data-source-design="${design}" data-source-state="${esc(variant)}" aria-label="更换书源" ${busy ? 'aria-busy="true"' : ''}><header class="source-concept-header"><button class="source-concept-back" data-action="close" aria-label="返回" ${busy || transaction ? 'disabled' : ''}>${icon('search_back',22)}</button><h1 title="更换书源">更换书源</h1><button class="source-concept-refresh" data-choice="source-discovery-mode" data-choice-value="${sweeping ? 'stopped' : 'sweeping'}" data-action-note="预览保留当前结果并展示查找/停止状态；不执行真实书源搜索。" ${busy || transaction ? 'disabled' : ''}>${sweeping ? '停止' : '重查'}</button></header><div class="source-concept-body"><div class="source-picker-scroll">${context}${discovery}${rows}${empty}${count && design === 'direct' ? '<p class="source-picker-help">点击书源即可切换</p>' : ''}</div>${recovery}${confirm}</div></section>`;
}

export function renderSourceSwitch(ctx) {
  if(ctx.book?.content !== 'manga')return renderNovelSourceConcept(ctx);
  const variant = ctx.variant || 'candidates';
  const manga = ctx.book?.content === 'manga';
  const busy = variant === 'switching';
  const transaction = variant === 'failure-transaction';
  const failed = variant === 'failure' || transaction || variant === 'discovery-error';
  const reconcile = variant === 'failure' && choice(ctx,'source-confirmation','unknown') === 'unknown';
  const candidates = retainedCandidates(ctx, variant);
  const discoveryMode = choice(ctx,'source-discovery-mode',variant === 'discovering' ? 'sweeping' : 'complete');
  const stopped = discoveryMode === 'stopped' && ['candidates','empty','discovering'].includes(variant);
  const sweeping = discoveryMode === 'sweeping' && ['candidates','discovering'].includes(variant);
  const selectedIndex = Number(choice(ctx,'source-selected-index',1));
  const count = candidates.length;
  const status = sweeping ? manga ? `正在查找 · 已发现 ${count} 个` : `正在查找 · ${count} 个来源` :
    busy ? '正在切换书源…' : transaction ? '换源失败' : reconcile ? '换源结果未确认' :
    variant === 'failure' ? '换源失败' : variant === 'discovery-error' ? '查找失败' :
    stopped ? manga ? `已停止 · 已发现 ${count} 个` : `已停止 · ${count} 个来源` :
    manga ? `查找完成 · 已发现 ${count} 个` : `查找完成 · ${count} 个来源`;
  const backDisabled = transaction || busy && !manga;
  const headerAction = sweeping ? hint('停止本次来源查找；已发现候选继续保留，不取消已经接受的换源写入。') :
    variant === 'candidates' ? hint('重新查找当前书籍的其他来源；按复合身份更新原候选并保持原列表位置。') :
    hint('沿原换源scope重试查找或结果核对；是否更新列表由真实回读决定，未知写入不能被新查找覆盖。');
  const error = choice(ctx,'source-error-message',variant === 'discovery-error' ? '当前来源暂时无法查找，请重试。' :
    transaction ? '换源事务未完成，请撤销切换后继续。' :
    reconcile ? '换源结果尚未确认，请重新核对。' : '目标书源暂时无法读取，请重试。');
  const coverUrl = ctx.book?.coverUrl || ctx.book?.cover;
  const title = ctx.book?.title || fixtures.title;
  const author = ctx.book ? ctx.book.author || '未知作者' : fixtures.author;
  // Book metadata stays independent from reader-chapter-index.
  const latestChapter = ctx.book?.latestChapter ?? ctx.book?.chapter;
  const source = ctx.book?.source || fixtures.source;
  const wide = ctx.size === 'wide';
  const validCover = typeof coverUrl === 'string' && coverUrl.trim() ? coverUrl : '';
  const bookCover = manga ? (validCover ? `<img class="source-picker-cover" src="${esc(validCover)}" alt="${esc(title)}封面">` : noCover()) :
    coverImage({...ctx.book, title, cover:validCover}, wide ? 64 : 48, wide ? 104 : 72, 6);
  const bookDetails = manga ? `<div><strong>${esc(title)}</strong><small>${esc([author,`当前来源：${source}`].join(' · '))}</small><small>正在读 ${esc(currentChapter(ctx))}</small></div>` :
    `<div class="lib-list-details source-picker-book-details"><div class="lib-list-title-row"><h3 title="${esc(title)}">${esc(title)}</h3></div><p title="${esc(author)}">${esc(author)}</p><small title="${esc(`最新：${latestChapter || '暂无最新章节'}`)}">最新：${esc(latestChapter || '暂无最新章节')}</small><small title="${esc(`当前书源：${source}`)}">当前书源：${esc(source)}</small></div>`;
  const rows = candidates.map(candidate => {
    const switching = busy && candidate.index === selectedIndex;
    const pendingProbe = sweeping && candidate.index > 0;
    const state = switching ? 'switching' : pendingProbe ? 'probing' : candidate.status;
    const statusLabel = switching ? '切换中' : pendingProbe ? '重测中' :
      candidate.status === 'offline' ? '读取失败' : candidate.status === 'timeout' ? '超时' : '';
    const label = statusLabel || `${candidate.latency} ms`;
    const rowAction = manga && candidate.index === 2 ? 'variant:manga-selection' : 'variant:switching';
    return `<button class="source-picker-row ${candidate.current ? 'current' : ''} ${switching ? 'switching' : ''}" aria-label="${esc(`${candidate.name}${candidate.current ? '，当前书源' : ''}，最新章节：${candidate.chapter}，${label}`)}" data-source-kind="${candidate.current ? 'current' : candidate.status}" data-choice="source-selected-index" data-choice-value="${candidate.index}" data-action="${candidate.current ? esc(hint('当前来源身份不重复切换。')) : rowAction}" ${candidate.current || variant !== 'candidates' ? 'disabled' : ''}><span class="source-picker-row-main"><span class="source-picker-title"><strong title="${esc(candidate.name)}">${esc(candidate.name)}</strong>${candidate.current ? '<span class="source-picker-current-tag">当前</span>' : ''}</span><span class="source-picker-chapter"><span>最新</span><small title="${esc(candidate.chapter)}">${esc(candidate.chapter)}</small></span></span><span class="source-picker-latency" data-probe-state="${state}" title="${esc(statusLabel ? statusLabel === '读取失败' || statusLabel === '超时' ? '上次读取未完成，可重新尝试' : statusLabel : `响应延迟 ${candidate.latency} 毫秒`)}">${statusLabel ? `<span>${statusLabel}</span>` : `<b>${candidate.latency}</b><small> ms</small>`}</span><span class="source-picker-chevron" aria-hidden="true">${icon('reader_chevron_right',12)}</span></button>`;
  }).join('');
  const empty = !count ? `<div class="source-picker-empty"><strong>${esc(sweeping ? '正在查找其他来源…' : variant === 'empty' && !stopped ? '未找到其他来源' : status)}</strong><small>${sweeping ? '找到后会陆续显示，可直接点选' : '可重新查找，或返回继续阅读'}</small></div>` : '';
  const recoveryLabel = transaction ? '撤销切换' : reconcile ? '重试核对' : '重试';
  const recoveryAction = hint(transaction ? '按原transactionId撤销换源；真实撤销完成才关闭并恢复原阅读。' :
    reconcile ? '核对原换源回执和intent；读取到pending不等于写入确认，不重复未知提交。' : '沿原换源scope重试查找，保留已发现候选和书籍上下文。');
  return `<section class="source-picker" aria-label="更换书源" data-source-state="${esc(variant)}" ${busy ? 'aria-busy="true"' : ''}><div class="source-picker-content"><div class="source-picker-scroll"><div class="source-picker-book ${manga ? 'manga' : 'novel'}">${bookCover}${bookDetails}</div><div class="source-picker-discovery"><div><span class="source-picker-spinner ${sweeping ? 'active' : ''}" aria-hidden="true"></span><span>${esc(status)}</span><small>按延迟排序</small></div></div>${rows}${empty}</div>${failed ? `<footer class="source-picker-recovery"><p>${esc(error)}</p><button data-action="${esc(recoveryAction)}">${recoveryLabel}</button></footer>` : ''}</div><header class="source-picker-header"><strong>更换书源</strong><div><button class="source-picker-back" data-action="close" aria-label="返回" ${backDisabled ? 'disabled' : ''}>${icon('source_switch_close',20)}</button><button class="source-picker-refresh" data-action="${esc(headerAction)}" data-choice="source-discovery-mode" data-choice-value="${sweeping ? 'stopped' : 'sweeping'}" ${busy || transaction ? 'disabled' : ''}>${sweeping ? '停止' : '重查'}</button></div></header></section>`;
}
