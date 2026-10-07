import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mangaDirectoryLabel, mangaDirectoryGridColumns, mangaDirectoryEntryRows, mangaDirectoryNearbyEntries,
  mangaDirectoryNodeRows, mangaDirectoryNodePlacement, mangaDirectoryNodePlacements, mangaDirectorySameNodeRun,
  mangaDirectoryNearbyNodes,
} from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup,
} from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { mangaDirectoryDisplay, mangaDirectoryStatusWidth } from '../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';

const titleRules = JSON.parse(readFileSync(new URL('./fixtures/manga-directory-rules-20261007.json', import.meta.url), 'utf8'));
const approvedRules = JSON.parse(readFileSync(new URL('../../Reader-UI/design/manga-directory/directory-rules-20261007.json', import.meta.url), 'utf8'));
assert.equal(approvedRules.fixtureSha256, createHash('sha256')
  .update(readFileSync(new URL('./fixtures/manga-directory-rules-20261007.json', import.meta.url))).digest('hex'),
  'the recorded design rules bind the exact shared regression corpus');
for (const rule of titleRules.cases) {
  const untouched = structuredClone(rule);
  const display = mangaDirectoryDisplay(rule);
  assert.equal(display.label.kind, rule.expectedKind, `approved classification: ${JSON.stringify(rule.title)}`);
  assert.equal(display.label.numberText, rule.expectedNumber ?? '');
  assert.equal(display.label.part, rule.expectedPart ?? '');
  if (rule.expectedDisplayTitle !== undefined) assert.equal(display.title, rule.expectedDisplayTitle);
  if (rule.expectedStatusText !== undefined) assert.equal(display.statusText, rule.expectedStatusText);
  assert.deepEqual(rule, untouched, 'display projection does not overwrite the canonical source title or metadata');
}
assert.equal(titleRules.publicTitleSnapshot.length, 681, 'retained official title snapshot is complete for this source');
for (const chapter of titleRules.publicTitleSnapshot) {
  // The decorated rule title is explicitly constructed evidence, not claimed
  // as a native dump. Only the source-confirmed metadata permits its projection.
  const source = { title: chapter.constructedRuleTitle, displayTitle: chapter.expectedDisplayTitle,
    isVip: chapter.isVipEvidence, index: chapter.index, canonicalUrl: chapter.canonicalUrl };
  const untouched = structuredClone(source);
  const display = mangaDirectoryDisplay(source);
  assert.equal(display.title, chapter.expectedDisplayTitle);
  assert.equal(display.label.kind, chapter.expectedLabelKind, `retained source title #${chapter.index}`);
  assert.equal(display.statusText, chapter.isVipEvidence === true ? 'VIP' : '');
  assert.deepEqual(source, untouched, 'source URL, raw rule title and canonical index survive display projection');
  if (chapter.constructedRuleTitle !== chapter.expectedDisplayTitle) {
    assert.equal(mangaDirectoryDisplay({ title: chapter.constructedRuleTitle }).label.kind, 'named',
      'a source-like decoration without its source metadata is never stripped by the Host');
  }
}
assert.equal(mangaDirectoryDisplay({ title: '  ' }).title, '未命名章节');
assert.equal(mangaDirectoryDisplay({ title: '第话' }).title, '未命名章节');
assert.equal(mangaDirectoryDisplay({ title: ' 第 话 ' }).title, '未命名章节');
assert.equal(mangaDirectoryDisplay({ title: '第话 真正标题' }).title, '第话 真正标题');
assert.equal(mangaDirectoryDisplay({ title: '💲100（上）', isVip: true }).label.kind, 'named');
assert.equal(mangaDirectoryDisplay({ title: '100', isPay: true }).statusText, '已购',
  'explicit isPay retains the documented purchased state and never implies a charge label');
assert.equal(mangaDirectoryDisplay({ title: '100', isVip: true, isPay: true }).statusText, 'VIP · 已购');
assert.equal(mangaDirectoryDisplay({ title: '100', isVip: true, isPay: false }).statusText, 'VIP');
assert.equal(mangaDirectoryDisplay({ title: '100', isVip: false, isPay: false }).statusText, '');
assert.equal(mangaDirectoryDisplay({ title: '100', isVip: false }).statusText, '');
assert.equal(mangaDirectoryDisplay({ title: '100', contextTitle: '卷一 / 卷二' }).contextTitle, '卷一 / 卷二');
assert.equal(mangaDirectoryStatusWidth('', 3.2), 0, 'absent source status reserves no width');
assert.ok(mangaDirectoryStatusWidth('VIP', 3.2) > mangaDirectoryStatusWidth('VIP', 1));

// Reviewed demo labels affect presentation only, including literal zeroes.
assert.deepEqual(mangaDirectoryLabel(' 003 '), { kind: 'numeric', numberText: '003', part: '' });
for (const title of ['41上', '41 上', '41（上）', '41 ( 上 )']) {
  assert.deepEqual(mangaDirectoryLabel(title), { kind: 'parts', numberText: '41', part: '上' });
}
assert.equal(mangaDirectoryLabel('41 中').part, '中');
assert.equal(mangaDirectoryLabel('41（下）').part, '下');
assert.deepEqual(mangaDirectoryLabel('第41话'), { kind: 'numeric', numberText: '41', part: '' });
assert.deepEqual(mangaDirectoryLabel('第41话（下）'), { kind: 'parts', numberText: '41', part: '下' });
assert.deepEqual(mangaDirectoryLabel('41·下'), { kind: 'parts', numberText: '41', part: '下' });
for (const title of ['第41话 真正标题', '第41话（下） 真正标题', '第一卷', '41（下', '41 下）', '番外 2', '']) {
  assert.equal(mangaDirectoryLabel(title).kind, 'named', `retain the entire named/ambiguous title: ${title}`);
}
assert.deepEqual([false, true].map(narrow => mangaDirectoryGridColumns('numeric', false, narrow)), [4, 3]);
assert.deepEqual([false, true].map(narrow => mangaDirectoryGridColumns('parts', false, narrow)), [4, 2]);
assert.deepEqual([false, true].map(narrow => mangaDirectoryGridColumns('parts', true, narrow)), [3, 3]);

const entry = (index, title, level, navigable = true) => ({ index, title, level, navigable, downloadState: 'unknown' });
const entries = [
  entry(1000, '外卷', 1, false),
  entry(2000, '内卷 · 整卷可读', 2),
  entry(53, '1', 3), entry(79, '2', 3),
  entry(96, '3 上', 3), entry(110, '3 中', 3), entry(143, '3 下', 3),
  entry(3000, '另一内卷', 2, false),
  entry(501, '1', 3), entry(601, '2', 3),
  entry(401, '4', 1, false), // Disabled leaf is not a branch, even with a numeric title.
  entry(402, '5', 1, undefined),
  entry(900, '章名很长 · 保留完整题目', 1),
];
// Passing undefined to a default argument would select true; this is the
// legacy unknown fact actually supplied by the gateway.
entries[11].navigable = undefined;
const presentation = mangaDirectoryPresentation(entries);
assert.equal(mangaDirectoryIsGroup(entries, 0), true);
assert.equal(mangaDirectoryIsGroup(entries, 1), false, 'readable whole volume remains a target');
assert.deepEqual(presentation.get(2000), {
  group: false, countComplete: true, hasChildren: true, readableParent: true,
  ancestorGroupIndexes: [1000], parentIndex: 1000, parentTitle: '外卷', contextTitle: '外卷', readableDescendantCount: 5,
});
assert.deepEqual(presentation.get(53).ancestorGroupIndexes, [1000, 2000]);
assert.equal(presentation.get(53).contextTitle, '外卷 / 内卷 · 整卷可读');
assert.equal(presentation.get(501).parentIndex, 3000, 'repeated display numbers keep their own explicit volume');
assert.equal(presentation.get(401).hasChildren, false);
assert.deepEqual(mangaDirectoryVisibleEntries(entries, presentation, [2000]).map(row => row.index),
  [1000, 2000, 3000, 501, 601, 401, 402, 900], 'a readable parent folds its descendants without losing its own target');
assert.deepEqual(mangaDirectoryVisibleEntries(entries, presentation, [1000]).map(row => row.index),
  [1000, 401, 402, 900], 'the outer group hides all explicit nested branches');

const rows = mangaDirectoryEntryRows(entries, presentation);
assert.deepEqual(rows.map(row => [row.kind, row.columns, row.entries.map(value => value.index)]), [
  ['row', 1, [1000]], ['row', 1, [2000]], ['numeric', 4, [53, 79]],
  ['parts', 3, [96, 110, 143]], ['row', 1, [3000]], ['numeric', 4, [501, 601]],
  ['row', 1, [401]], ['row', 1, [402]], ['row', 1, [900]],
]);
assert.equal(rows[2].entries[0], entries[2], 'layout retains the original canonical DTO and all optional facts');
assert.deepEqual(mangaDirectoryEntryRows([entries[2], entries[8]], presentation).map(row => row.entries.map(value => value.index)),
  [[53], [501]], 'filtered roots with the same label kind cannot mix different parents into one row');
const pairs = [entry(700, '41 上', 1), entry(901, '41 下', 1), entry(902, '42 上', 1), entry(999, '42 下', 1), entry(1001, '43 上', 1)];
assert.deepEqual(mangaDirectoryEntryRows(pairs, mangaDirectoryPresentation(pairs), true).map(row => row.entries.map(value => value.index)),
  [[700, 901], [902, 999], [1001]], 'the narrow pair grid ends a partial row without placeholder targets');
assert.deepEqual(mangaDirectoryNearbyEntries(pairs, mangaDirectoryPresentation(pairs), 999, 0, 0).map(row => row.index),
  [902, 999], 'an exact preview boundary preserves the current chapter pair');
assert.deepEqual(mangaDirectoryNearbyEntries(entries, presentation, 110, 0, 0).map(row => row.index),
  [96, 110, 143], 'upper/middle/lower parts of the current explicit parent stay together');
assert.deepEqual(mangaDirectoryNearbyEntries(entries, presentation, 501, 0, 0).map(row => row.index), [501],
  'the other volume with the same display number is not a neighbor identity');
const previewCandidates = Array.from({ length: 20 }, (_, ordinal) => entry(100 + ordinal * 19, String(ordinal + 1), 1));
assert.equal(mangaDirectoryNearbyEntries(previewCandidates, mangaDirectoryPresentation(previewCandidates), 100).length, 8,
  'the first-chapter preview fills its eight candidates from the available following chapters');
assert.equal(mangaDirectoryNearbyEntries(previewCandidates, mangaDirectoryPresentation(previewCandidates), 100 + 19 * 19).length, 8,
  'the last-chapter preview fills from the available preceding chapters');
assert.equal(mangaDirectoryNearbyEntries(previewCandidates, mangaDirectoryPresentation(previewCandidates), 100, 3, 4, false).length, 5,
  'quick owners can retain a strict current-neighbor window near an edge');

const unknownHierarchy = [entry(4, '第一卷', undefined, false), entry(9, '1', undefined), entry(17, '2', undefined)];
assert.equal(mangaDirectoryPresentation(unknownHierarchy).size, 0, 'titles cannot manufacture hierarchy');
assert.equal(mangaDirectoryEntryRows(unknownHierarchy, mangaDirectoryPresentation(unknownHierarchy))[0].kind, 'row');
assert.ok(mangaDirectoryEntryRows(unknownHierarchy, mangaDirectoryPresentation(unknownHierarchy)).every(row => row.kind === 'row'),
  'numeric labels cannot manufacture missing hierarchy facts');
const incomplete = [entry(7, '组', 1, false), entry(8, '内卷', 2), entry(9, '未知深度', undefined), entry(11, '1', 3)];
const incompletePresentation = mangaDirectoryPresentation(incomplete);
assert.equal(incompletePresentation.get(7).countComplete, false);
assert.equal(incompletePresentation.get(8).hasChildren, false, 'the missing child depth does not prove a readable parent');
assert.deepEqual(incompletePresentation.get(11).ancestorGroupIndexes, [], 'missing depth breaks the path rather than guessing a parent');

const node = (nodeId, title, chapterIndex, parentId = 'p1', kind = 'target', hasChildren = false) =>
  ({ nodeId, title, chapterIndex, parentId, kind, depth: 2, hasChildren, expanded: true });
const nodes = [node('a', '1', 503), node('b', '2', 707), node('c', '3', 901),
  node('d', '4', 1201), node('e', '5', 1301),
  node('f', '6', 1401, 'p2'), node('parent', '7', 1501, 'p2', 'target', true),
  node('disabled', '8', undefined, 'p2', 'disabled'), node('named', '第9话 真正标题', 1901, 'p2'),
  node('upper', '10 上', 2301, 'p2'), node('middle', '10 中', 2501, 'p2'), node('lower', '10 下', 2901, 'p2')];
assert.equal(mangaDirectorySameNodeRun(nodes[4], nodes[5]), false);
assert.equal(mangaDirectorySameNodeRun(nodes[5], nodes[6]), false, 'a readable parent never enters a number grid');
const nodeRows = mangaDirectoryNodeRows(nodes, false, 256);
assert.deepEqual(nodeRows.map(row => [row.startIndex, row.kind, row.columns, row.nodes.map(value => value.nodeId)]), [
  [256, 'numeric', 4, ['a', 'b', 'c', 'd']], [260, 'numeric', 4, ['e']], [261, 'numeric', 4, ['f']],
  [262, 'row', 1, ['parent']], [263, 'row', 1, ['disabled']], [264, 'row', 1, ['named']],
  [265, 'parts', 3, ['upper', 'middle', 'lower']],
]);
const placements = mangaDirectoryNodePlacements(nodes, false, 256);
assert.equal(placements.length, nodes.length, 'Core visible slots remain one-to-one for paged virtualization');
for (let ordinal = 0; ordinal < nodes.length; ordinal += 1) {
  assert.deepEqual(mangaDirectoryNodePlacement(nodes, ordinal, false, 256), placements[ordinal]);
  const placement = placements[ordinal];
  assert.equal(placement.nodes[256 + ordinal - placement.startIndex], nodes[ordinal], 'a cell keeps the exact canonical DTO');
  assert.ok(placement.nodes.length <= placement.columns);
}
assert.equal(placements[1].leader, false);
assert.equal(placements[4].rowLength, 1);
assert.equal(placements[10].columns, 3);
assert.equal(placements[10].nodes[1].chapterIndex, 2501, 'the display number never replaces a sparse canonical index');
assert.deepEqual(mangaDirectoryNearbyNodes(nodes, 2501, 0, 0).map(value => value.nodeId), ['upper', 'middle', 'lower']);
assert.equal(mangaDirectoryNearbyNodes(nodes, 1501, 0, 0)[0], nodes[6], 'a whole-volume preview keeps its actual readable parent target');
assert.equal(mangaDirectoryNodePlacement(nodes, -1), undefined);
assert.equal(mangaDirectoryNodePlacement(nodes, nodes.length), undefined);

// Same canonical slots, conservative width budgets: accessibility scaling
// changes columns rather than shortening identifiers or shrinking typography.
const largeLabels = [entry(17, '123456', 1), entry(41, '123457', 1), entry(73, '123458', 1)];
const largeFacts = mangaDirectoryPresentation(largeLabels);
assert.equal(mangaDirectoryEntryRows(largeLabels, largeFacts, false, 1, 370)[0].columns, 4);
assert.equal(mangaDirectoryEntryRows(largeLabels, largeFacts, false, 2, 370)[0].columns, 2);
assert.deepEqual(mangaDirectoryEntryRows(largeLabels, largeFacts, true, 3.2, 280)
  .flatMap(row => row.entries), largeLabels, 'every target survives a one-column adaptive projection');
const enormous = [entry(7, '123456789012345678901234567890', 1)];
const overflowRows = mangaDirectoryEntryRows(enormous, mangaDirectoryPresentation(enormous), true, 2, 280);
assert.equal(overflowRows[0].kind, 'row', 'identifiers wider than one lane wrap as a complete title');
assert.equal(overflowRows[0].entries[0], enormous[0]);
const gridRun = Array.from({ length: 9 }, (_, at) => entry(at * 19, `${at + 1}`, 1));
const margins = mangaDirectoryEntryRows(gridRun, mangaDirectoryPresentation(gridRun));
assert.deepEqual(margins.map(row => [row.runStart, row.runEnd]), [[true, false], [false, false], [false, true]],
  'a fallback run has one 12vp outer margin and 8vp interior gaps');
const fullGroups = [entry(1, '卷甲', 1, false), entry(11, '首卷话', 2), entry(2, '卷乙', 1, false), entry(3, '话', 2)];
const adjacentGroups = [fullGroups[0], fullGroups[2], fullGroups[3]];
assert.deepEqual(mangaDirectoryEntryRows(adjacentGroups, mangaDirectoryPresentation(fullGroups))
  .map(row => row.groupSpacing ?? 0), [0, 12, 0], 'only adjacent explicit group headings gain the CSS group margin');
const enlargedNodes = [node('big-a', '123456', 17), node('big-b', '123457', 41), node('big-c', '123458', 73)];
const enlargedPlacements = mangaDirectoryNodePlacements(enlargedNodes, false, 256, 2, 370);
assert.equal(enlargedPlacements[0].columns, 2);
for (let at = 0; at < enlargedNodes.length; at += 1) {
  assert.deepEqual(mangaDirectoryNodePlacement(enlargedNodes, at, false, 256, 2, 370), enlargedPlacements[at]);
}

const page = Array.from({ length: 256 }, (_, ordinal) => node(`node-${ordinal}`, String(ordinal + 1), ordinal * 17));
assert.equal(mangaDirectoryNodePlacements(page, false, 512).length, 256);
assert.deepEqual(mangaDirectoryNodePlacements(page, true, 512).at(-1).nodes.map(value => value.nodeId), ['node-253', 'node-254', 'node-255']);
assert.equal(mangaDirectoryNodePlacements(page, true, 512).at(-1).startIndex, 765,
  'absolute Core slot phase preserves later row anchors when the resident window starts mid-row');

const downloadLabels = [entry(3, '21', 1), entry(4, '22', 1), entry(5, '23', 1)];
const downloadFacts = mangaDirectoryPresentation(downloadLabels);
assert.equal(mangaDirectoryEntryRows(downloadLabels, downloadFacts, true, 3.2, 280)[0].columns, 2,
  'a three-digit minimum budget prevents ordinary 99/100 transitions from changing every resident column');
assert.equal(mangaDirectoryEntryRows(downloadLabels, downloadFacts, true, 3.2, 280, 24)[0].columns, 2,
  'shared entry layout reserves the real download control before admitting numeric columns');

const canonicalRows = rows => rows.flatMap(row => row.entries ?? row.nodes);
const transition = ['98', '99', '100', '101', '102', '103'].map((title, at) => entry(4000 + at * 17, title, 1));
assert.deepEqual(mangaDirectoryEntryRows(transition, mangaDirectoryPresentation(transition), false, 2, 260)
  .map(row => row.columns), [3, 3], 'ordinary two/three-digit transitions use the same finite numeric lane budget');
const varyingAccessories = mangaDirectoryEntryRows(downloadLabels, downloadFacts, false, 2, 260,
  candidate => candidate.index === 3 ? 24 : 0);
assert.deepEqual(varyingAccessories.map(row => row.columns), [2, 3],
  'only the real painted accessory reduces its own compatible row, not every resident target');
assert.deepEqual(canonicalRows(varyingAccessories), downloadLabels);
const vipEntries = transition.slice(0, 3).map((candidate, at) => ({ ...candidate, isVip: at === 1 }));
assert.deepEqual(mangaDirectoryEntryRows(vipEntries, mangaDirectoryPresentation(vipEntries), false, 3.2, 280)
  .map(row => row.columns), [2, 1, 2], 'source VIP width is reserved only for the actual source status');

// One overflowing chapter never forces its unrelated neighbors into full rows.
const oneOverflow = [entry(71, '99', 1), entry(73, '100', 1), enormous[0], entry(79, '101', 1), entry(83, '102', 1)];
const oneOverflowRows = mangaDirectoryEntryRows(oneOverflow, mangaDirectoryPresentation(oneOverflow), false, 2, 280);
assert.equal(oneOverflowRows.filter(row => row.kind === 'row').length, 1);
assert.equal(oneOverflowRows.find(row => row.kind === 'row').entries[0], enormous[0]);
assert.ok(oneOverflowRows.filter(row => row.kind === 'numeric').length >= 2);
assert.deepEqual(canonicalRows(oneOverflowRows), oneOverflow);

const numberedPairs = ['100上', '100下', '101上', '101下', '102上', '102下']
  .map((title, at) => entry(5010 + at * 23, title, 1));
const pairFacts = mangaDirectoryPresentation(numberedPairs);
assert.deepEqual(mangaDirectoryEntryRows(numberedPairs, pairFacts, false, 1, 370)
  .map(row => [row.columns, row.entries.map(candidate => candidate.title)]), [
    [4, ['100上', '100下', '101上', '101下']], [4, ['102上', '102下']],
  ], 'four lanes contain complete neighboring pairs without invented cells');
assert.deepEqual(mangaDirectoryEntryRows(numberedPairs, pairFacts, false, 1, 330, 24)
  .map(row => [row.columns, row.entries.map(candidate => candidate.title)]), [
    [2, ['100上', '100下']], [2, ['101上', '101下']], [2, ['102上', '102下']],
  ], 'a raw width capacity of three becomes two pair lanes instead of mixing neighboring part groups');
assert.deepEqual(mangaDirectoryEntryRows(numberedPairs, pairFacts, false, 3.2, 280)
  .map(row => row.columns), [1, 1, 1, 1, 1, 1], 'large text keeps each real part in order with one lane');

const triples = ['100上', '100中', '100下', '101上', '101中', '101下']
  .map((title, at) => entry(6000 + at * 29, title, 1));
assert.deepEqual(mangaDirectoryEntryRows(triples, mangaDirectoryPresentation(triples), false, 1, 370)
  .map(row => row.entries.map(candidate => candidate.title)), [
    ['100上', '100中', '100下'], ['101上', '101中', '101下'],
  ]);
assert.deepEqual(mangaDirectoryEntryRows(triples, mangaDirectoryPresentation(triples), false, 1, 240)
  .map(row => row.columns), [1, 1, 1, 1, 1, 1], 'triplets never degrade into two-lane cross-row part slices');
const incompleteParts = ['100上', '101下', '102上', '102上', '102下']
  .map((title, at) => entry(7100 + at, title, 1));
const incompleteRows = mangaDirectoryEntryRows(incompleteParts, mangaDirectoryPresentation(incompleteParts), false, 1, 370);
assert.deepEqual(incompleteRows.map(row => row.entries.map(candidate => candidate.title)),
  [['100上'], ['101下'], ['102上'], ['102上', '102下']], 'missing and repeated parts never invent missing targets or regroup by titles');
assert.deepEqual(canonicalRows(incompleteRows), incompleteParts);
const crossedParents = [node('p1-upper', '100上', 8001, 'volume-1'), node('p2-lower', '100下', 9001, 'volume-2')];
assert.deepEqual(mangaDirectoryNodeRows(crossedParents).map(row => row.nodes.map(candidate => candidate.nodeId)),
  [['p1-upper'], ['p2-lower']], 'the same display number never joins parts across authoritative parents');
const unknownLeaf = { ...node('unknown-leaf', '100', 9301), hasChildren: undefined };
assert.equal(mangaDirectoryNodeRows([unknownLeaf])[0].kind, 'row', 'unknown child facts cannot enter a compact node grid');

const decoratedEntry = { ...entry(10001, '✿·\n100（上）', 1), displayTitle: '100（上）', isVip: true, contextTitle: '卷一' };
const decoratedNode = { ...node('decorated', decoratedEntry.title, decoratedEntry.index), ...decoratedEntry };
assert.deepEqual(mangaDirectoryEntryRows([decoratedEntry], mangaDirectoryPresentation([decoratedEntry]))[0].labels,
  mangaDirectoryNodeRows([decoratedNode])[0].labels, 'both rendering paths classify the same explicit display metadata');
assert.deepEqual(canonicalRows(mangaDirectoryEntryRows([decoratedEntry], mangaDirectoryPresentation([decoratedEntry]),
  false, 1, 370, 0, '100')), [decoratedEntry]);
assert.equal(mangaDirectoryEntryRows([decoratedEntry], mangaDirectoryPresentation([decoratedEntry]),
  false, 1, 370, 0, '100')[0].kind, 'row', 'a number search result uses a whole row with its contextual title');
assert.equal(mangaDirectoryNodeRows([decoratedNode], false, 0, 1, 370, 0, '100')[0].kind, 'row');
assert.equal(mangaDirectoryNodePlacement([decoratedNode], 0, false, 0, 1, 370, 0, '100').kind, 'row');
assert.equal(mangaDirectoryNodePlacements([decoratedNode], false, 0, 1, 370, 0, '100')[0].kind, 'row');

// A partial resident first row is conservative; loading preceding real slots
// can complete it, while all later absolute row anchors stay unchanged.
const resident = Array.from({ length: 512 }, (_, at) => node(`resident-${at}`, String(at + 1), 11000 + at));
const fullResidentRows = mangaDirectoryNodeRows(resident, true, 256, 1, 330);
const laterResidentRows = mangaDirectoryNodeRows(resident.slice(256), true, 512, 1, 330);
assert.deepEqual(laterResidentRows[0].nodes, [resident[256]]);
assert.deepEqual(laterResidentRows.slice(1).map(row => [row.startIndex, row.nodes.map(candidate => candidate.nodeId)]),
  fullResidentRows.filter(row => row.startIndex >= 513).map(row => [row.startIndex, row.nodes.map(candidate => candidate.nodeId)]),
  'adding the preceding page leaves every later absolute numeric row boundary unchanged');
const partialParts = [node('tail-lower', '100下', 12001), node('next-upper', '101上', 12003), node('next-lower', '101下', 12005)];
assert.deepEqual(mangaDirectoryNodeRows(partialParts, false, 256, 1, 370).map(row => row.nodes.map(candidate => candidate.nodeId)),
  [['tail-lower'], ['next-upper', 'next-lower']], 'a resident part boundary never substitutes a fake upper part');
const pairPage = Array.from({ length: 6 }, (_, number) => ['上', '下'].map((part, at) =>
  node(`pair-${number}-${part}`, `${100 + number}${part}`, 13000 + number * 17 + at))).flat();
const allPairRows = mangaDirectoryNodeRows(pairPage, false, 0, 1, 370);
const boundedPairRows = mangaDirectoryNodeRows(pairPage.slice(1), false, 1, 1, 370);
assert.deepEqual(canonicalRows(boundedPairRows), pairPage.slice(1));
assert.deepEqual(boundedPairRows.filter(row => row.startIndex >= 4)
  .map(row => [row.startIndex, row.nodes.map(candidate => candidate.nodeId)]),
  allPairRows.filter(row => row.startIndex >= 4).map(row => [row.startIndex, row.nodes.map(candidate => candidate.nodeId)]),
  'loading the real preceding upper part changes only the boundary fragment, not later four-lane pair anchors');

console.log('Manga directory layout: source-confirmed projection, retained title cases, explicit hierarchy, complete part groups, per-item width and bounded absolute row anchors passed');
