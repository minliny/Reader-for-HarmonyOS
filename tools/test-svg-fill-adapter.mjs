import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'interior-attribute-order': {
    description: 'Actual filled-bookmark recipe preserves path geometry and explicit fill with d first or last; rejects an existing path fill.',
    resources: [],
  },
  'none-attribute-order': {
    description: 'Actual multi-path grid recipe applies fill=none to every path with d first or last; rejects an existing path fill.',
    resources: [],
  },
};

for (const id of selectContractCases(definitions)) {
  const { renderRecipe } = await import('./sync-svg-assets.mjs');
  const { svgAssetRecipes } = await import('./svg-provenance.config.mjs');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const sourceDirectory = path.join(root, 'docs/ui-design/svg-provenance/figma-icons');
  const file = id === 'interior-attribute-order' ? 'reader_page_bookmark_filled' : 'bookshelf_grid';
  const recipe = svgAssetRecipes.find(value => value.file === file);
  assert.ok(recipe, 'current registered recipe exists');
  const expectedFill = id === 'interior-attribute-order' ? recipe.color : 'none';
  assert.equal(id === 'interior-attribute-order' ? recipe.fillInterior : recipe.fillNone, true);
  const original = await readFile(path.join(sourceDirectory, recipe.sourceFile), 'utf8');
  const paths = value => value.match(/<path\b[^>]*>/g) ?? [];
  const geometry = value => paths(value).map(tag => tag.match(/\bd="([^"]+)"/)[1]);
  assert.ok(paths(original).length > 0, 'real upstream geometry is present');
  if (id === 'none-attribute-order') assert.ok(paths(original).length > 1, 'covers every path');
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-svg-fill-adapter-'));
  const fixture = path.join(directory, recipe.sourceFile);
  // Only the input file is redirected. The registered recipe's actual adapter
  // and all other production fields run unchanged; production files stay read-only.
  const fixtureRecipe = { ...recipe, sourceFile: path.relative(sourceDirectory, fixture) };
  try {
    for (const order of ['first', 'last']) {
      const source = original.replace(/<path\b([^>]*?)(\/?)>/g, (tag, attributes, close) => {
        const data = attributes.match(/\bd="[^"]+"/)[0];
        const rest = attributes.replace(data, '').trim();
        return order === 'first' ? `<path ${data} ${rest}${close}>` : `<path ${rest} ${data}${close}>`;
      });
      await writeFile(fixture, source);
      const { content } = await renderRecipe(fixtureRecipe);
      assert.deepEqual(geometry(content), geometry(original), 'original path geometry is preserved');
      for (const tag of paths(content)) {
        assert.equal((tag.match(/\bfill="[^"]*"/g) ?? []).length, 1, 'exactly one explicit fill per path');
        assert.ok(tag.includes(`fill="${expectedFill}"`), 'registered fill semantics survive attribute order');
      }
    }
    await writeFile(fixture, original.replace(/<path\b/, '<path fill="none"'));
    await assert.rejects(renderRecipe(fixtureRecipe), /paths already carry a fill attribute/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  recordContractCasePass(id);
}
