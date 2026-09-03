#!/usr/bin/env node
/**
 * Gate test for the visual-acceptance fixture branch. Enforces:
 * (a) every fixture command key is a command the app actually issues,
 * (b) every literal scenario value is strict JSON (JSON.parse-able),
 * (c) cross-reference consistency between literals and the novel fixture,
 * (d) scope guardrail — only the three wiring sites may reference VisualTest*,
 * (e) novel chapters are long enough to paginate.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const etsRoot = path.join(repoRoot, 'entry/src/main/ets');
const read = (relative) => readFileSync(path.join(repoRoot, relative), 'utf8');

function walkEtsFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...walkEtsFiles(full));
    } else if (/\.(ts|ets)$/.test(name)) {
      found.push(full);
    }
  }
  return found;
}

function matchBrace(text, start) {
  const open = text[start];
  const closeCh = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  throw new Error(`unbalanced ${open}...${closeCh}`);
}

/** Extracts each top-level `'method': <value>` entry as parseable JSON text. */
function extractMapEntries(source, exportName) {
  const decl = new RegExp(`export const ${exportName}[^=]*= \\{`);
  const declMatch = decl.exec(source);
  assert.ok(declMatch, `${exportName} must be declared as an object literal`);
  const openIndex = declMatch.index + declMatch[0].length - 1;
  const closeIndex = matchBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  const entries = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) {
      i++;
    }
    if (i >= body.length || body[i] === '}') {
      break;
    }
    const keyMatch = /^'([^']+)'\s*:\s*/.exec(body.slice(i));
    assert.ok(keyMatch, `${exportName} entry must start with a quoted method key`);
    i += keyMatch[0].length;
    const valueStart = i;
    const valueEnd = matchBrace(body, i);
    entries[keyMatch[1]] = body.slice(valueStart, valueEnd + 1);
    i = valueEnd + 1;
  }
  return entries;
}

// ---------- (a) command union ----------

const fixtureFiles = [
  'entry/src/main/ets/app/visual/VisualTestConfig.ts',
  'entry/src/main/ets/app/visual/VisualTestFixtures.ts',
  'entry/src/main/ets/app/visual/fixtures/DefaultScenario.ts',
  'entry/src/main/ets/app/visual/fixtures/EmptyScenario.ts',
  'entry/src/main/ets/app/visual/fixtures/FixtureNovelText.ts',
];
for (const file of fixtureFiles) {
  read(file);
}

const commandUnion = new Set();
for (const file of walkEtsFiles(etsRoot)) {
  if (file.includes(`${path.sep}visual${path.sep}`)) {
    continue;
  }
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\.request\(\s*['"`]([a-z][a-zA-Z0-9._-]*)['"`]/g)) {
    commandUnion.add(match[1]);
  }
}
assert.ok(commandUnion.has('bookshelf.list'), 'command union must capture app request sites');

// ---------- (b) strict-JSON literal values ----------

const defaultScenario = read('entry/src/main/ets/app/visual/fixtures/DefaultScenario.ts');
const emptyScenario = read('entry/src/main/ets/app/visual/fixtures/EmptyScenario.ts');

function parseEntries(source, exportName) {
  const entries = extractMapEntries(source, exportName);
  const parsed = {};
  for (const [key, valueText] of Object.entries(entries)) {
    let value;
    try {
      value = JSON.parse(valueText);
    } catch (error) {
      throw new Error(`${exportName}['${key}'] is not strict JSON: ${error.message}`);
    }
    parsed[key] = value;
  }
  return parsed;
}

const defaultLiterals = parseEntries(defaultScenario, 'DEFAULT_LITERALS');
const emptyLiterals = parseEntries(emptyScenario, 'EMPTY_LITERALS');

const searchBooksMatch = /export const FIXTURE_SEARCH_BOOKS[^=]*= (\[[\s\S]*?\n\]);/.exec(defaultScenario);
assert.ok(searchBooksMatch, 'FIXTURE_SEARCH_BOOKS must be a literal array');
const fixtureSearchBooks = JSON.parse(searchBooksMatch[1]);

for (const key of Object.keys(defaultLiterals)) {
  assert.match(key, /^[a-z][a-zA-Z0-9._-]*$/,
    `fixture key ${key} must look like a protocol command`);
  assert.ok(commandUnion.has(key),
    `fixture key ${key} is not issued anywhere in ets sources`);
}
for (const key of Object.keys(emptyLiterals)) {
  assert.ok(commandUnion.has(key),
    `empty-scenario key ${key} is not issued anywhere in ets sources`);
}

// Cold-start commands must always be answerable.
for (const literals of [defaultLiterals, emptyLiterals]) {
  assert.ok(literals['source.switch.pending.list'],
    'source.switch.pending.list is a cold-start command and must have a fixture');
  assert.ok(literals['bookshelf.list'],
    'bookshelf.list is a cold-start command and must have a fixture');
}

// ---------- (c) cross-reference consistency ----------

const novelText = read('entry/src/main/ets/app/visual/fixtures/FixtureNovelText.ts');
const novelGenerator = read('tools/generate-visual-novel-fixtures.mjs');
assert.match(novelText, /Deterministic synthetic text/,
  'novel fixture must identify itself as deterministic synthetic data');
assert.doesNotMatch(novelGenerator, /readFileSync|SOURCE_PATH|homedir/,
  'novel generator must not read external source material');
const novelTitle = /export const NOVEL_TITLE = "([^"]+)";/.exec(novelText)?.[1];
const novelAuthor = /export const NOVEL_AUTHOR = "([^"]+)";/.exec(novelText)?.[1];
assert.ok(novelTitle && novelAuthor, 'novel title/author must be exported literals');

const chapterContents = novelText.split('content: `').slice(1)
  .map((chunk) => chunk.slice(0, chunk.indexOf('`,\n  }')));
const chapterTitles = [...novelText.matchAll(/title: "([^"]+)",\n {4}content:/g)].map((m) => m[1]);
assert.equal(chapterContents.length, chapterTitles.length,
  'every novel chapter needs a title');
assert.ok(chapterContents.length >= 3, 'novel must provide at least 3 chapters');

// ---------- (e) novel chapter sizes ----------

let totalChars = 0;
chapterContents.forEach((content, index) => {
  totalChars += content.length;
  assert.ok(content.length >= 2000,
    `chapter ${index + 1} (${chapterTitles[index]}) has only ${content.length} chars, needs >= 2000`);
  const paragraphs = content.split('\n').filter((line) => line.trim().length > 0);
  assert.ok(paragraphs.length >= 20,
    `chapter ${index + 1} (${chapterTitles[index]}) has only ${paragraphs.length} paragraphs`);
  assert.ok(!content.includes('`') && !content.includes('${'),
    `chapter ${index + 1} contains a template-literal escape`);
});
assert.equal(new Set(chapterTitles).size, chapterTitles.length, 'chapter titles must be unique');

function shelfBooks(literals) {
  const rule = literals['bookshelf.list'];
  const rules = Array.isArray(rule) ? rule : [rule];
  const books = [];
  for (const entry of rules) {
    if (entry.match !== undefined) {
      continue;
    }
    books.push(...entry.data.books);
  }
  return books;
}

const localBookIds = new Set();
for (const book of shelfBooks(defaultLiterals)) {
  assert.equal(typeof book.sourceId, 'string');
  assert.equal(typeof book.bookId, 'string');
  assert.equal(typeof book.title, 'string');
  assert.equal(typeof book.author, 'string');
  assert.ok(Number.isFinite(book.addedAt) && Number.isFinite(book.sortIndex),
    `${book.bookId} needs finite addedAt and sortIndex`);
  if (book.sourceId === 'local') {
    assert.equal(book.title, novelTitle, `local book ${book.bookId} title must match the novel`);
    assert.equal(book.author, novelAuthor, `local book ${book.bookId} author must match the novel`);
    assert.equal(book.chapterCount, chapterContents.length,
      `${book.bookId} chapterCount must match the novel chapter count`);
    if (book.currentChapterTitle !== undefined) {
      assert.ok(chapterTitles.includes(book.currentChapterTitle),
        `${book.bookId} currentChapterTitle must be a novel chapter title`);
      assert.ok(book.currentChapterIndex < chapterContents.length,
        `${book.bookId} currentChapterIndex must be within the novel`);
    }
    localBookIds.add(book.bookId);
  }
}
assert.ok(localBookIds.size >= 2, 'default shelf needs at least two local books');

const defaultRules = defaultLiterals['bookshelf.list'];
assert.ok(Array.isArray(defaultRules), 'bookshelf.list must be an array of rules');
assert.ok(defaultRules.some((rule) => rule.match?.hasReadingProgress === true),
  'bookshelf.list must answer the continue-reading query (hasReadingProgress)');

const bookshelfGet = defaultLiterals['bookshelf.get'];
assert.ok(Array.isArray(bookshelfGet), 'bookshelf.get must be an array of match rules');
for (const entry of bookshelfGet) {
  assert.ok(localBookIds.has(entry.match.bookId),
    `bookshelf.get rule for ${entry.match.bookId} must match a shelf book`);
  assert.equal(entry.data.book.title, novelTitle);
  assert.equal(entry.data.book.author, novelAuthor);
}

for (const bookmark of defaultLiterals['bookmark.list'].bookmarks) {
  assert.equal(bookmark.bookName, novelTitle);
  assert.equal(bookmark.bookAuthor, novelAuthor);
  assert.ok(chapterTitles.includes(bookmark.chapterName),
    `bookmark chapterName ${bookmark.chapterName} must be a novel chapter title`);
  assert.ok(bookmark.chapterIndex < chapterContents.length);
}

for (const record of defaultLiterals['read-record.list'].records) {
  assert.equal(record.bookName, novelTitle, 'read records must reference the novel');
  assert.ok(Number.isSafeInteger(record.readTime) && record.readTime >= 0);
}

const history = defaultLiterals['search.history.list'];
assert.equal(history.count, history.keywords.length, 'search history count must match keywords');
assert.ok(history.keywords.every((keyword) => keyword.trim().length > 0));

for (const source of defaultLiterals['source.list'].sources) {
  assert.ok(source.sourceId && source.name, 'sources need sourceId and name');
  assert.equal(typeof source.enabled, 'boolean', 'source.enabled must be a boolean');
  assert.equal(typeof source.enabledExplore, 'boolean', 'source.enabledExplore must be a boolean');
}

const rssSources = defaultLiterals['rss-source.list'].sources;
assert.ok(rssSources.length >= 2, 'rss needs at least two subscriptions');
const rssIds = new Set();
for (const entry of rssSources) {
  const subscription = entry.subscription;
  assert.ok(subscription, 'rss source entry needs a subscription object');
  assert.ok(subscription.subscriptionId && subscription.feedUrl && typeof subscription.title === 'string');
  assert.equal(typeof subscription.enabled, 'boolean');
  assert.ok(Number.isSafeInteger(subscription.unreadCount) && subscription.unreadCount >= 0);
  rssIds.add(subscription.subscriptionId);
}

const rssItems = defaultLiterals['rss.subscription.items'];
for (const entry of rssItems) {
  const data = entry.data;
  assert.equal(data.count, data.items.length, 'rss items count must match items');
  assert.equal(data.unreadCount, data.subscription.unreadCount,
    'rss items unreadCount must match subscription');
  assert.ok(data.unreadCount <= data.count, 'rss unreadCount must not exceed count');
  const guids = new Set(data.items.map((item) => item.guid));
  assert.equal(guids.size, data.items.length, 'rss guids must be unique');
  assert.ok(rssIds.has(entry.match.subscriptionId), 'rss items must match a listed subscription');
}

const rssFavorites = defaultLiterals['rss.favorite.list'];
for (const entry of rssFavorites) {
  assert.equal(entry.data.count, entry.data.favorites.length, 'rss favorites count must match');
  assert.ok(rssIds.has(entry.match.subscriptionId), 'rss favorites must match a listed subscription');
}

// Novel-derived builder must cover the literal shelf books.
const builderZone = defaultScenario.slice(defaultScenario.indexOf('export function buildNovelScenario'));
for (const bookId of localBookIds) {
  assert.ok(builderZone.includes(`"bookId": bookId`) || builderZone.includes(bookId),
    `novel builder must cover ${bookId}`);
}
assert.ok(builderZone.includes("NOVEL_CHAPTERS[i].content"),
  'chapter content must come from FixtureNovelText');
assert.ok(builderZone.includes(".content.length"),
  'metrics must be computed from the novel text');
assert.ok(defaultScenario.includes("const LOCAL_BOOK_IDS = [LOCAL_TXT_BOOK_ID, LOCAL_EPUB_BOOK_ID]"),
  'novel builder must iterate exactly the two local book ids');

// ---------- (d) scope guardrail ----------

const allowedVisualReferences = new Set([
  path.join(etsRoot, 'app/ReaderRuntimeOwner.ts'),
  path.join(etsRoot, 'entryability/EntryAbility.ets'),
]);
for (const file of walkEtsFiles(etsRoot)) {
  const inVisualDir = file.includes(`${path.sep}visual${path.sep}`);
  if (inVisualDir) {
    continue;
  }
  const source = readFileSync(file, 'utf8');
  if (/VisualTest\w*|visual\/VisualTest/.test(source)) {
    assert.ok(allowedVisualReferences.has(file),
      `VisualTest* referenced outside the wiring scope: ${path.relative(repoRoot, file)}`);
  }
}

const ownerSource = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
assert.match(ownerSource, /if \(visualModeActive\(\)\) \{\s*return visualFixtureRespond\(method, params\);/,
  'request() must intercept before start() while visual mode is active');
assert.match(ownerSource, /async start\(\): Promise<void> \{\s*\/\/ Visual-acceptance branch[^\n]*\n\s*if \(visualModeActive\(\)\) \{\s*return;/,
  'start() must be a no-op while visual mode is active');

const entryAbility = read('entry/src/main/ets/entryability/EntryAbility.ets');
assert.match(entryAbility, /installVisualScenario\(want\);\s*\n\s*const owner = ReaderRuntimeOwner\.install/,
  'EntryAbility must install the visual scenario before the runtime owner');

const productScope = read('entry/src/main/ets/app/ReaderProductScope.ts');
assert.match(productScope, /return 'visual-test';/, 'visual branch must run the visual-test profile');

console.log(`visual fixtures: PASS (${Object.keys(defaultLiterals).length} default commands, ` +
  `${Object.keys(emptyLiterals).length} empty commands, ${chapterContents.length} novel chapters, ${totalChars} chars)`);
