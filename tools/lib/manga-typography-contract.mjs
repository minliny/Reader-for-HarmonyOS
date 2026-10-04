import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as families from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { auditTypographyConsumers, typographyRoleImports, typographyProperties } from './reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';

const contract = JSON.parse(readFileSync(new URL('../fixtures/design/manga-typography-baseline.json', import.meta.url), 'utf8'));
const carriers = { Text: "Text('manga')", Span: "Span('manga')", Button: "Button('manga')", TextInput: "TextInput({text:''})" };
const dependencies = { ...families, FontWeight: { Regular: 400, Medium: 500, Bold: 700 },
  entry: { index: 7, navigable: true }, item: { node: { index: 7 } }, selected: false };
const tuple = node => Object.fromEntries(typographyProperties.filter(p => Object.hasOwn(node, p)).map(p => [p, node[p]]));

/** New manga inputs have their own finite contract; no historical typography
 * budget or novel baseline is raised. Restore the exact imported source and
 * compare every authored modifier/AUTO omission through the real SDK. */
export function verifyMangaTypographyContracts({ sdk = false } = {}) {
  const sites = [];
  for (const file of contract.files) {
    const source = readFileSync(new URL('../../' + file.path, import.meta.url), 'utf8');
    const imported = typographyRoleImports(source, file.path), actual = auditTypographyConsumers(source, file.path), used = new Set(), edits = [];
    for (const expected of file.nodes) {
      const node = actual.find(n => !used.has(n) && n.owner === expected.owner && n.method === expected.method && n.kind === expected.kind && n.text === expected.text);
      assert.ok(node, file.path + ': exact manga carrier'); used.add(node);
      assert.deepEqual(Object.keys(node.modifiers).sort(), Object.keys(expected.original).sort(), 'manga native AUTO omissions are unchanged');
      for (const [property, expression] of Object.entries(expected.changes)) {
        const modifier = node.modifiers[property];
        assert.equal(modifier.expression, expression, file.path + '/' + expected.method + ': actual public role binding');
        assert.deepEqual(modifier.extra, expected.extra[property], 'manga secondary variable-font options');
        for (const match of expression.matchAll(/TYPE_\w+/g)) {
          assert.ok(imported.has(match[0]), 'actual imported manga role ' + match[0]);
          assert.ok(readerTypographyRoles[match[0]], 'actual implemented manga role ' + match[0]);
        }
        edits.push({ ...modifier, replacement: expected.original[property] });
      }
      sites.push({ file: file.path, expected, actual: node, method: 'site' + sites.length });
    }
    let restored = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) restored = restored.slice(0, edit.start) + edit.replacement + restored.slice(edit.end);
    assert.ok(restored.startsWith(file.roleImport)); restored = restored.slice(file.roleImport.length);
    for (const extra of file.extras ?? []) {
      assert.ok(extra.after && restored.includes(extra.after), 'exact registered directory paint successor');
      restored = restored.replace(extra.after, extra.before);
    }
    assert.equal(createHash('sha256').update(restored).digest('hex'), file.sha256,
      file.path + ': only typography arguments/import added, no layout/callback/ownership delta');
  }
  assert.equal(sites.length, 71, 'exact five imported manga chrome carriers, no generic exception');
  if (!sdk) return sites.length;
  const sourceFor = original => `@Component struct MangaTypographyProbe {\n${sites.map(site => {
    const modifiers = Object.keys(site.expected.original).map(p => `.${p}(${original ? site.expected.original[p] : site.actual.modifiers[p].expression}${site.expected.extra[p].length ? ', ' + site.expected.extra[p].join(', ') : ''})`).join('\n');
    assert.ok(carriers[site.expected.kind]);
    return `@Builder private ${site.method}() { ${carriers[site.expected.kind]}\n${modifiers}\n }`;
  }).join('\n')}\nbuild() { Column() {} }\n}`;
  const names = sites.map(s => s.method), after = createReaderBuilderProbe(sourceFor(false), names, dependencies).Component;
  const scenarios = [];
  for (const group of [false, true]) for (const current of [false, true]) for (const catalog of [false, true]) for (const narrow of [false, true]) {
    scenarios.push({ stageWidth: narrow ? 650 : 900, mangaCatalogDisplay: catalog, mangaCatalogNarrow: narrow,
      currentChapterIndex: current ? 7 : 9, rowPresentation: () => ({ group }), isCurrentMangaNode: () => current,
      // Frozen R8 getter semantics retain the 550 static face with authored
      // weight400; group600 and ordinary400 keep their original tuples.
      rowFontFamily(entry) { return group ? families.READER_FONT_NOTO_SANS_SC_UI_600 : entry.navigable !== false && entry.index === this.currentChapterIndex ? families.READER_FONT_NOTO_SANS_SC_UI_550 : families.READER_FONT_NOTO_SANS_SC_UI_REGULAR; } });
  }
  for (const selected of [false, true]) {
    const deps = { ...dependencies, selected }, before = createReaderBuilderProbe(sourceFor(true), names, deps).Component,
      migrated = createReaderBuilderProbe(sourceFor(false), names, deps).Component;
    for (const scenario of scenarios) for (const site of sites) {
      const a = Object.assign(new before(undefined), scenario), b = Object.assign(new migrated(undefined), scenario);
      a[site.method](); b[site.method](); assert.equal(a.nodes.size, 1); assert.equal(b.nodes.size, 1);
      assert.deepEqual(tuple([...b.nodes.values()][0]), tuple([...a.nodes.values()][0]), site.file + ': native tuple and AUTO');
    }
  }
  const altered = { ...readerTypographyRoles.TYPE_MANGA_SHEET_SECTION, fontSizeFp: 15 };
  const propagated = createReaderBuilderProbe(sourceFor(false), names, { ...dependencies, TYPE_MANGA_SHEET_SECTION: altered }).Component;
  let changed = 0, unchanged = 0;
  for (const site of sites) {
    const p = Object.assign(new propagated(undefined), scenarios[0]), b = Object.assign(new after(undefined), scenarios[0]);
    p[site.method](); b[site.method]();
    if (site.actual.modifiers.fontSize?.expression === 'TYPE_MANGA_SHEET_SECTION.fontSizeFp') { changed++; assert.equal([...p.nodes.values()][0].fontSize, [...b.nodes.values()][0].fontSize + 2); }
    else if (!Object.values(site.expected.changes).some(s => s.includes('TYPE_MANGA_SHEET_SECTION'))) { unchanged++; assert.deepEqual(tuple([...p.nodes.values()][0]), tuple([...b.nodes.values()][0])); }
  }
  assert.ok(changed >= 3 && unchanged > 0, 'actual finite manga role propagates across native consumers without changing other roles');
  return sites.length;
}
