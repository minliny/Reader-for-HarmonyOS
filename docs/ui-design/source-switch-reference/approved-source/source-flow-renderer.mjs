import { esc, icon } from './shared.mjs';

export const drawerStages = new Set(['opening','discovering','stopped','ready']);
export function sourceFlowDiscoveryPhase(state) {
  if(state.stage === 'opening' || state.discovery === 'running') return '正在查找';
  return state.discovery === 'stopped' ? '已停止' : '查找结束';
}
export function sourceFlowStatus(state) {
  const count = state.candidates.length;
  return `${sourceFlowDiscoveryPhase(state)} · 已找到 ${count} 个书源`;
}
export function sourceFlowRow(candidate) {
  return `<button class="source-flow-row" data-source-key="${esc(candidate.key)}" aria-label="${esc(`${candidate.sourceName}，最新章节 ${candidate.latestChapter}，搜索耗时 ${candidate.searchLatencyMs} 毫秒，点击换源`)}"><span class="source-flow-row-info"><strong>${esc(candidate.sourceName)}</strong><small title="${esc(candidate.latestChapter)}">${esc(candidate.latestChapter)}</small></span><span class="source-flow-time">${esc(candidate.searchLatencyMs)}<small> ms</small></span></button>`;
}
export function sourceFlowDrawer(state) {
  const running = state.discovery === 'running' || state.stage === 'opening';
  return `<div class="source-flow-modal" data-phase="${esc(state.stage)}"><button class="source-flow-backdrop" data-flow-action="dismiss" aria-label="关闭换源窗口" tabindex="-1"></button><section class="source-flow-drawer" role="dialog" aria-modal="true" aria-labelledby="source-flow-title" tabindex="-1"><div class="source-flow-grip" aria-hidden="true"></div><header class="source-flow-heading"><h1 id="source-flow-title">更换书源</h1><button data-flow-action="dismiss" aria-label="关闭换源窗口">${icon('source_switch_close',22)}</button></header><div class="source-flow-book"><img class="source-flow-cover" src="assets/source-flow-cover.png" width="60" height="84" alt="山间札记封面"><div><h2>${esc(state.book.title)}</h2><p>${esc(state.book.author)}</p><small>最新章节：${esc(state.book.latestChapter)}</small><small data-current-source>当前书源：${esc(state.book.source)}</small></div></div>
    <div class="source-flow-discovery" data-running="${running}">
      <span class="source-flow-indicator" aria-hidden="true"><span class="source-flow-activity"><span class="reading-spinner"></span></span><span class="source-flow-idle-icon">${icon('search_mag',18)}</span></span>
      <span data-discovery-status role="status" aria-live="polite" aria-atomic="true" aria-label="${esc(sourceFlowStatus(state))}"><strong data-discovery-count><span class="source-flow-count-prefix">已找到</span><b data-discovery-number>${state.candidates.length}</b><span class="source-flow-count-unit">个书源</span></strong><small data-discovery-phase>${esc(sourceFlowDiscoveryPhase(state))}</small></span>
      <button data-flow-action="discovery" ${state.stage === 'opening' ? 'disabled' : ''}><span class="source-flow-action-icon" aria-hidden="true">${icon('settings_gen_refresh',14)}</span><span data-discovery-action-label>${running ? '停止' : '重新查找'}</span></button>
    </div>
    <div class="source-flow-columns"><span>书源 / 最新章节</span><span>搜索耗时</span></div><div class="source-flow-results" data-source-results aria-label="检查成功的书源">${state.candidates.map(sourceFlowRow).join('')}<p class="source-flow-empty" data-empty-state ${state.candidates.length ? 'hidden' : ''}>${running ? '正在查找其他书源…' : '未找到其他书源'}</p></div><footer class="source-flow-footer">点击书源切换</footer></section></div>`;
}
export function sourceFlowSwitch(state) {
  const labels = {prepare:'准备目标书源',locate:'定位当前章节',finish:'恢复阅读'};
  return `<section class="source-flow-transition" role="status" aria-live="polite" aria-busy="true"><div class="source-flow-transition-inner"><span class="source-flow-switch-activity" aria-hidden="true"><span class="reading-spinner"></span></span><h2>正在切换书源</h2><strong>${esc(state.selected.sourceName)}</strong><p data-switch-step>${labels[state.switchStep] || labels.prepare}</p><small>${esc(state.book.chapter)} · 保留阅读位置</small></div></section>`;
}
