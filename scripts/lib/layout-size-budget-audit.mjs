import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTRACT_URL = new URL('../../tests/navigation-geometry/design-size-contract.json', import.meta.url);

export function loadDesignSizeContract() {
  return JSON.parse(readFileSync(fileURLToPath(CONTRACT_URL), 'utf8'));
}

function parseBounds(boundsText) {
  const nums = String(boundsText ?? '').match(/-?\d+/g);
  if (!nums || nums.length !== 4) return undefined;
  const [x1, y1, x2, y2] = nums.map(Number);
  return { x1, y1, x2, y2 };
}

function flattenNodes(root, density) {
  const list = [];
  const walk = (node, parent, ancestors) => {
    const attrs = node?.attributes ?? {};
    const px = parseBounds(attrs.bounds);
    const vp = px
      ? {
          x1: px.x1 / density,
          y1: px.y1 / density,
          x2: px.x2 / density,
          y2: px.y2 / density,
          width: (px.x2 - px.x1) / density,
          height: (px.y2 - px.y1) / density,
        }
      : undefined;
    const item = {
      type: String(attrs.type ?? ''),
      id: String(attrs.id ?? ''),
      text: String(attrs.text ?? ''),
      vp,
      parent,
      ancestors,
      raw: node,
      children: [],
    };
    list.push(item);
    if (parent) parent.children.push(item);
    const nextAncestors = [...ancestors, item];
    for (const child of node?.children ?? []) {
      walk(child, item, nextAncestors);
    }
  };
  walk(root, undefined, []);
  return list;
}

function resolveDensity(root, explicitDensity, contract) {
  if (Number.isFinite(explicitDensity) && explicitDensity > 0) return explicitDensity;
  const rootBounds = parseBounds(root?.attributes?.bounds);
  if (rootBounds && rootBounds.x2 === 1280) return 3.5;
  return contract.defaultDensityPxPerVp ?? 3.5;
}

function nonSystemNodes(nodes) {
  return nodes.filter(node => !node.ancestors.some(a => a.id.startsWith('StatusBar') || a.id.startsWith('[Live]')));
}

function subtreeHas(node, predicate) {
  if (predicate(node)) return true;
  return node.children.some(child => subtreeHas(child, predicate));
}

function findDescendants(node, predicate, out = []) {
  for (const child of node.children) {
    if (predicate(child)) out.push(child);
    findDescendants(child, predicate, out);
  }
  return out;
}

function isClippedAtBottom(node, viewportHeightVp) {
  return Boolean(node.vp && node.vp.y2 >= viewportHeightVp - 2 && node.vp.y1 > viewportHeightVp - 80);
}

export function detectDumpLayoutScreen(tree, explicitDensity) {
  const contract = loadDesignSizeContract();
  const density = resolveDensity(tree, explicitDensity, contract);
  const nodes = nonSystemNodes(flattenNodes(tree, density));
  if (nodes.some(n => n.id === 'reader-control-motion-dock')) return 'readerControlQuick';
  if (nodes.some(n => n.id === 'reader.bookshelf.viewport:0' || n.id === 'reader-bookshelf-view-list')) return 'bookshelf';
  if (nodes.some(n => n.id.startsWith('reader-settings-home-group:') || n.id === 'reader-settings-general')) return 'settingsHome';
  if (nodes.some(n => n.id === 'reader-source-filter-block')) return 'sourceManagement';
  if (nodes.some(n => n.id.startsWith('reader-download:'))) return 'downloads';
  if (nodes.some(n => n.id === 'reader-detail-primary-action' || n.id.startsWith('reader-detail-preview-') || n.id.endsWith('"detail-source"]'))) return 'bookDetail';
  if (nodes.some(n => n.text === 'App 主题' || n.text === '减少动态效果')) return 'generalSettings';
  return 'unknown';
}

function selectRuleNodes(rule, nodes, windowWidthVp, windowHeightVp) {
  const m = rule.match ?? {};
  if (m.id) return nodes.filter(n => n.id === m.id && n.vp);
  if (m.parentOfId) return nodes.filter(n => n.id === m.parentOfId && n.parent?.vp).map(n => n.parent);
  if (m.idPrefix) return nodes.filter(n => n.id.startsWith(m.idPrefix) && n.vp && !isClippedAtBottom(n, windowHeightVp));
  if (m.idIn) return nodes.filter(n => m.idIn.includes(n.id) && n.vp);
  if (m.idSuffix) return nodes.filter(n => n.id.endsWith(m.idSuffix) && (!m.type || n.type === m.type) && n.vp);
  if (m.idSuffixIn) return nodes.filter(n => m.idSuffixIn.some(s => n.id.endsWith(s)) && n.vp);
  if (m.parentOfText) {
    return nodes
      .filter(n => n.text === m.parentOfText && (!m.ancestorIdPrefix || n.ancestors.some(a => a.id.startsWith(m.ancestorIdPrefix))))
      .map(n => {
        if (!m.type) return n.parent;
        return [...n.ancestors].reverse().find(a => a.type === m.type);
      })
      .filter(n => n?.vp);
  }
  if (m.type) {
    return nodes.filter(n => n.type === m.type && n.vp && (m.minYVp === undefined || n.vp.y1 >= m.minYVp) && !isClippedAtBottom(n, windowHeightVp));
  }
  if (m.ruleKind === 'settingsHomeBadge') {
    const groups = nodes.filter(n => n.id.startsWith('reader-settings-home-group:'));
    const badges = [];
    for (const group of groups) {
      findDescendants(group, n => n.type === 'Stack' && n.vp && Math.abs(n.vp.width - n.vp.height) <= 1.2 && n.vp.width >= 20 && n.vp.width <= 40, badges);
    }
    return badges;
  }
  if (m.ruleKind === 'generalSettingsCardRow') {
    const seen = new Set();
    const rows = [];
    for (const n of nodes) {
      if (n.type !== 'Row' || !n.vp || n.vp.width < windowWidthVp - 60 || n.vp.height < 40 || n.vp.height > 120) continue;
      if (n.id === 'reader-native-slot' || n.ancestors.some(a => a.id.startsWith('reader-native-slot:'))) continue;
      const hasKnownRowLabel = n.children.some(c => subtreeHas(c, x => ['App 主题', '减少动态效果', '点击当前底栏回顶部', '恢复默认设置'].includes(x.text)));
      if (hasKnownRowLabel && n.parent?.type === 'Column' && !seen.has(n)) {
        seen.add(n);
        rows.push(n);
      }
    }
    return rows;
  }
  if (m.ruleKind === 'generalSettingsSegmentedRow') {
    return nodes.filter(n =>
      n.type === 'Row' &&
      n.vp &&
      n.vp.width >= 140 &&
      n.vp.width <= 200 &&
      n.children.some(c => subtreeHas(c, x => ['跟随', '默认', '效果优先'].includes(x.text))),
    );
  }
  if (m.ruleKind === 'generalSettingsSwitchButton') {
    const results = [];
    for (const toggle of nodes.filter(n => n.id.startsWith('reader-toggle:') && n.vp && !isClippedAtBottom(n, windowHeightVp))) {
      const containerRow = toggle.ancestors.slice().reverse().find(a => a.type === 'Row' && a.vp && a.vp.width >= 280);
      if (!containerRow) continue;
      const labelBtn = findDescendants(containerRow, c => c.type === 'Button' && c.vp && c.vp.width >= 180)[0];
      const textLeaves = labelBtn ? findDescendants(labelBtn, c => c.type === 'Text' && c.text.trim().length > 0) : [];
      if (labelBtn && textLeaves.length === 1) results.push(labelBtn);
    }
    return results;
  }
  if (m.ruleKind === 'sourceListRow') {
    const rows = [];
    for (const toggle of nodes.filter(n => n.id.startsWith('reader-toggle:') && n.vp && !isClippedAtBottom(n, windowHeightVp))) {
      const cardCol = toggle.ancestors.slice().reverse().find(a =>
        a.type === 'Column' &&
        a.vp &&
        a.vp.width >= windowWidthVp - 50 &&
        !a.id.startsWith('reader-source-') &&
        a.vp.y2 < windowHeightVp - 2,
      );
      if (cardCol && !rows.includes(cardCol)) rows.push(cardCol);
    }
    return rows;
  }
  if (m.ruleKind === 'downloadBookCover') {
    const covers = [];
    for (const row of nodes.filter(n => n.id.startsWith('reader-download:book-title:') && n.vp && n.vp.y2 < windowHeightVp - 2 && n.vp.height >= 50)) {
      const firstStack = row.children.find(c => c.type === 'Stack' && c.vp);
      if (firstStack) covers.push(firstStack);
    }
    return covers;
  }
  return [];
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatRange(range) {
  return `[${range[0]}, ${range[1]}]vp`;
}

export function auditDumpLayout(tree, options = {}) {
  const contract = loadDesignSizeContract();
  const density = resolveDensity(tree, options.density, contract);
  const nodes = nonSystemNodes(flattenNodes(tree, density));
  const rootVp = parseBounds(tree?.attributes?.bounds);
  const windowWidthVp = rootVp ? (rootVp.x2 - rootVp.x1) / density : contract.narrowViewportWidthVp;
  const windowHeightVp = rootVp ? (rootVp.y2 - rootVp.y1) / density : 809.1;
  const screen = options.screen && options.screen !== 'auto' ? options.screen : detectDumpLayoutScreen(tree, density);
  const rules = contract.dumpLayoutBudgets[screen];

  if (!rules) {
    return {
      source: options.source ?? 'unknown',
      screen,
      density,
      windowWidthVp: round1(windowWidthVp),
      windowHeightVp: round1(windowHeightVp),
      status: 'UNSUPPORTED',
      checks: [],
      violations: [],
    };
  }

  const checks = [];
  const violations = [];

  for (const rule of rules) {
    const severity = rule.severity ?? 'BLOCK';
    if (rule.match?.verticalGapFromId) {
      const topNode = nodes.find(n => n.id === rule.match.verticalGapFromId && n.vp);
      const bottomNode = nodes.find(n => n.id === rule.match.toId && n.vp);
      if (!topNode || !bottomNode) {
        checks.push({
          id: rule.id,
          label: rule.label,
          expected: `gap <= ${rule.maxGap}vp`,
          actual: 'not_found',
          passed: false,
          severity,
        });
        violations.push({
          ruleId: rule.id,
          label: rule.label,
          severity,
          expected: `gap <= ${rule.maxGap}vp`,
          actual: 'missing endpoint nodes',
        });
        continue;
      }
      const gap = round1(bottomNode.vp.y1 - topNode.vp.y2);
      const passed = gap <= rule.maxGap;
      checks.push({
        id: rule.id,
        label: rule.label,
        expected: `<= ${rule.maxGap}vp`,
        actual: `${gap}vp`,
        passed,
        severity,
      });
      if (!passed) {
        violations.push({
          ruleId: rule.id,
          label: rule.label,
          severity,
          expected: `<= ${rule.maxGap}vp`,
          actual: `${gap}vp`,
        });
      }
      continue;
    }

    const targets = selectRuleNodes(rule, nodes, windowWidthVp, windowHeightVp);
    if (targets.length === 0) {
      const passed = !rule.required;
      checks.push({
        id: rule.id,
        label: rule.label,
        expected: rule.required ? 'present' : 'optional (no visible items)',
        actual: '0 nodes',
        passed,
        severity,
      });
      if (!passed) {
        violations.push({
          ruleId: rule.id,
          label: rule.label,
          severity,
          expected: 'required node present',
          actual: 'missing',
        });
      }
      continue;
    }

    const expectedParts = [];
    if (rule.width) expectedParts.push(`w=${formatRange(rule.width)}`);
    if (rule.height) expectedParts.push(`h=${formatRange(rule.height)}`);
    if (rule.insetX !== undefined) expectedParts.push(`insetX=${rule.insetX}±${rule.insetTolerance}vp`);
    if (rule.aspectRatio) expectedParts.push(`ratio=[${rule.aspectRatio[0]}, ${rule.aspectRatio[1]}]`);

    const failingSamples = [];
    const actualSamples = [];

    for (const target of targets) {
      const v = target.vp;
      const insetLeft = round1(v.x1);
      const insetRight = round1(windowWidthVp - v.x2);
      const ratio = v.height > 0 ? Math.round((v.width / v.height) * 1000) / 1000 : 0;
      const sampleDesc = `${round1(v.width)}×${round1(v.height)}vp inset(${insetLeft},${insetRight})`;
      actualSamples.push(sampleDesc);

      let failReason = '';
      if (rule.width && (v.width < rule.width[0] - 0.1 || v.width > rule.width[1] + 0.1)) {
        failReason += `w=${round1(v.width)}vp `;
      }
      if (rule.height && (v.height < rule.height[0] - 0.1 || v.height > rule.height[1] + 0.1)) {
        failReason += `h=${round1(v.height)}vp `;
      }
      if (rule.insetX !== undefined) {
        const tol = rule.insetTolerance ?? 1.5;
        if (Math.abs(insetLeft - rule.insetX) > tol || Math.abs(insetRight - rule.insetX) > tol) {
          failReason += `inset=(${insetLeft},${insetRight})vp `;
        }
      }
      if (rule.aspectRatio && (ratio < rule.aspectRatio[0] || ratio > rule.aspectRatio[1])) {
        failReason += `ratio=${ratio} `;
      }
      if (failReason) failingSamples.push(failReason.trim());
    }

    const uniqueSamples = [...new Set(actualSamples)].slice(0, 3).join('; ');
    const uniqueFails = [...new Set(failingSamples)].slice(0, 3).join('; ');
    const passed = failingSamples.length === 0;
    checks.push({
      id: rule.id,
      label: rule.label,
      expected: expectedParts.join(', '),
      actual: `${uniqueSamples} (${targets.length})`,
      passed,
      severity,
    });
    if (!passed) {
      violations.push({
        ruleId: rule.id,
        label: rule.label,
        severity,
        expected: expectedParts.join(', '),
        actual: uniqueFails,
      });
    }
  }

  const hasBlock = violations.some(v => v.severity === 'BLOCK');
  const hasWarn = violations.some(v => v.severity === 'WARN');
  return {
    source: options.source ?? 'unknown',
    screen,
    density,
    windowWidthVp: round1(windowWidthVp),
    windowHeightVp: round1(windowHeightVp),
    status: hasBlock ? 'FAIL' : hasWarn ? 'WARN' : 'PASS',
    checks,
    violations,
  };
}

const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderLayoutAuditMarkdown(results) {
  const lines = ['# HarmonyOS UI Layout Size Audit', ''];
  const alerts = results.flatMap(r => r.violations.map(v => ({ source: r.source, screen: r.screen, ...v })));
  if (alerts.length > 0) {
    lines.push('## Alerts', '');
    for (const a of alerts) {
      lines.push(`- **[${a.severity}] ${a.source} (${a.screen}) · ${a.ruleId}**: ${a.label} — expected \`${a.expected}\`, got \`${a.actual}\``);
    }
    lines.push('');
  }
  for (const r of results) {
    lines.push(`## ${r.source} · \`${r.screen}\` · ${r.status} (${r.windowWidthVp}×${r.windowHeightVp}vp @${r.density}x)`, '');
    lines.push('| Rule | Target | Expected | Measured | Status |', '| --- | --- | --- | --- | --- |');
    for (const c of r.checks) {
      lines.push(`| \`${c.id}\` | ${c.label} | ${c.expected} | ${c.actual} | ${c.passed ? 'PASS' : c.severity} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function renderLayoutAuditHtml(results) {
  const alerts = results.flatMap(r => r.violations.map(v => ({ source: r.source, screen: r.screen, ...v })));
  const alertHtml = alerts.length > 0
    ? `<section class="alerts"><h2>Alerts (${alerts.length})</h2><ul>${alerts.map(a =>
        `<li class="${a.severity.toLowerCase()}"><strong>[${escapeHtml(a.severity)}] ${escapeHtml(a.source)} (${escapeHtml(a.screen)})</strong> · ${escapeHtml(a.label)}: expected <code>${escapeHtml(a.expected)}</code>, actual <code>${escapeHtml(a.actual)}</code></li>`,
      ).join('')}</ul></section>`
    : '<section class="alerts pass"><h2>No Violations</h2><p>All audited dumps satisfy design size budgets.</p></section>';

  const sections = results.map(r => `
<section class="card">
  <h3>${escapeHtml(r.source)} · <code>${escapeHtml(r.screen)}</code> · <span class="badge ${r.status.toLowerCase()}">${escapeHtml(r.status)}</span> (${r.windowWidthVp}×${r.windowHeightVp}vp @${r.density}x)</h3>
  <table>
    <thead><tr><th>Rule</th><th>Target</th><th>Expected</th><th>Measured</th><th>Status</th></tr></thead>
    <tbody>${r.checks.map(c =>
      `<tr class="${c.passed ? 'ok' : 'bad'}"><td><code>${escapeHtml(c.id)}</code></td><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.expected)}</td><td>${escapeHtml(c.actual)}</td><td>${c.passed ? 'PASS' : escapeHtml(c.severity)}</td></tr>`,
    ).join('')}</tbody>
  </table>
</section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>HarmonyOS UI Layout Size Audit</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 24px; background: #f4efe6; color: #1d1b18; }
  .alerts, .card { background: #fbf8f2; border: 1px solid #d5cec4; border-radius: 14px; padding: 16px; margin-bottom: 18px; }
  .alerts.pass { border-color: #1f3d31; }
  .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
  .badge.pass { background: #e8eee7; color: #1f3d31; }
  .badge.fail { background: #fbe9e7; color: #b83b32; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e7e4db; }
  tr.bad td { background: #fff0ee; color: #8c231c; }
</style>
</head>
<body>
<h1>HarmonyOS UI Layout Size Audit (墨纸青松 2.0)</h1>
${alertHtml}
${sections}
</body>
</html>`;
}
