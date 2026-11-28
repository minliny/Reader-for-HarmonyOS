#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  auditDumpLayout,
  renderLayoutAuditHtml,
  renderLayoutAuditMarkdown,
} from './lib/layout-size-budget-audit.mjs';

function main() {
  const { values } = parseArgs({
    options: {
      dump: { type: 'string', multiple: true },
      'dump-dir': { type: 'string' },
      density: { type: 'string' },
      screen: { type: 'string', default: 'auto' },
      html: { type: 'string' },
      md: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });

  const files = [...(values.dump ?? [])];
  if (values['dump-dir']) {
    for (const entry of readdirSync(values['dump-dir']).filter(f => f.endsWith('.json')).sort()) {
      files.push(resolve(values['dump-dir'], entry));
    }
  }
  if (files.length === 0) {
    console.error('Usage: node scripts/audit-ui-layout.mjs --dump <path> [--dump-dir <dir>] [--density <n>] [--screen <name>] [--html <path>] [--md <path>] [--json]');
    process.exit(2);
  }

  const density = values.density === undefined ? undefined : Number(values.density);
  const results = files.map(filePath => {
    const tree = JSON.parse(readFileSync(filePath, 'utf8'));
    return auditDumpLayout(tree, {
      source: basename(filePath),
      density,
      screen: values.screen,
    });
  });

  if (values.html) {
    mkdirSync(dirname(values.html), { recursive: true });
    writeFileSync(values.html, renderLayoutAuditHtml(results));
  }
  if (values.md) {
    mkdirSync(dirname(values.md), { recursive: true });
    writeFileSync(values.md, renderLayoutAuditMarkdown(results));
  }

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(renderLayoutAuditMarkdown(results));
  }

  const hasBlock = results.some(result => result.violations.some(v => v.severity === 'BLOCK'));
  process.exitCode = hasBlock ? 1 : 0;
}

main();
