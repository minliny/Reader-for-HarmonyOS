const layoutRules = Array.from({ length: 14 }, (_, index) => `R${index + 1}`);
const transitionRules = ['T1', 'T2', 'T3', 'T4'];
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const escapeMarkdown = value => escapeHtml(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]|]/g, '\\$&');
const duration = receipt => receipt.seconds === undefined ? '' : ` · ${receipt.seconds} s`;

function relativeUrl(...parts) {
  const segments = parts.join('/').split('/');
  if (segments.some(part => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) return undefined;
  return segments.map(part => encodeURIComponent(part).replaceAll('(', '%28').replaceAll(')', '%29')).join('/');
}

function findings(reports, rules) {
  return reports.flatMap(report => (report?.violations ?? []).flatMap(violation => {
    const rule = violation.rule ?? violation.ruleId ?? violation.id;
    if (!rules.includes(rule)) return [];
    const frame = Number.isSafeInteger(violation.frame) ? report?.frames?.[violation.frame] : undefined;
    return [{ rule, detail: violation.message ?? violation.detail ?? violation.code ?? '',
      ...(Number.isFinite(frame?.atMs) ? { nativeFrameMs: frame.atMs } : {}) }];
  }));
}

function marks(rules, reports, violations) {
  const observed = new Set(reports.flatMap(report => report?.observedRules ?? []));
  return rules.map(rule => {
    const state = violations.some(violation => violation.rule === rule) ? 'violation' :
      observed.has(rule) ? 'observed' : 'unobserved';
    return `<span class="${state}" aria-label="${rule} ${state}">${rule}</span>`;
  }).join('');
}

function imageLink(file, label) {
  return `<a href="${escapeHtml(file)}"><img src="${escapeHtml(file)}" loading="lazy" alt="${escapeHtml(label)}"></a>`;
}

export function renderVisualReview(receipts) {
  const alerts = [];
  const markdownSections = [];
  const sections = [];
  for (const [receiptIndex, receipt] of receipts.entries()) {
    const sectionId = `journey-${receiptIndex + 1}`;
    const profile = receipt.profile?.id === 'observed-default' ? undefined : receipt.profile?.id;
    const title = [profile, `${receipt.journey} · ${receipt.status}${duration(receipt)}`].filter(Boolean).join(' · ');
    const directory = receipt.relativeDirectory ?? receipt.journey;
    const receiptLink = receipt.steps ? relativeUrl(directory, 'receipt.json') : undefined;
    const markdown = [`## ${escapeMarkdown(title)}`, ''];
    if (receiptLink) markdown.push(`[Journey receipt](${receiptLink})`, '');
    const cards = [];
    const coverage = (receipt.externalCoverage ?? []).map(item =>
      `${item.step} · ${item.status} · ${item.reason}`);
    const failedCheckpoint = receipt.failure?.step;
    for (const [stepIndex, step] of (receipt.steps ?? []).entries()) {
      const id = `${sectionId}-step-${stepIndex + 1}`;
      const reports = [step.report];
      const transitions = Array.isArray(step.transition) ? step.transition : step.transition ? [step.transition] : [];
      const violations = [...findings(reports, layoutRules), ...findings(transitions, transitionRules)];
      const screen = step.screenCap?.file ? relativeUrl(directory, step.screenCap.file) : undefined;
      const frames = (step.transitionCaptures ?? []).flatMap(frame => {
        const url = frame.file && relativeUrl(directory, frame.file);
        return url && Number.isFinite(frame.timestampMs) ? [{ url, timestampMs: frame.timestampMs }] : [];
      }).sort((left, right) => left.timestampMs - right.timestampMs);
      const stepSizeAudit = step.sizeAudit;
      const sizeChecks = Array.isArray(stepSizeAudit?.checks) ? stepSizeAudit.checks : [];
      const sizeViolations = Array.isArray(stepSizeAudit?.violations) ? stepSizeAudit.violations : [];
      if (step.status === 'BLOCKED' && step.reason) {
        alerts.push({ id: sectionId, evidence: receiptLink, label: `${title} · ${step.step}`,
          detail: step.reason, priority: 1 });
      }
      if (!screen && frames.length === 0 && transitions.length === 0 && violations.length === 0 && sizeChecks.length === 0) continue;
      const name = step.step ?? step.action ?? `Checkpoint ${stepIndex + 1}`;
      const suspectFrames = new Set();
      for (const violation of violations) {
        const { rule, nativeFrameMs, detail } = violation;
        const closest = nativeFrameMs === undefined ? undefined : frames.reduce((best, frame) =>
          !best || Math.abs(frame.timestampMs - nativeFrameMs) < Math.abs(best.timestampMs - nativeFrameMs) ? frame : best,
        undefined);
        if (closest) suspectFrames.add(closest.url);
        const annotation = nativeFrameMs === undefined ? detail : `${detail} · Native frame ${nativeFrameMs} ms`;
        alerts.push({ id, evidence: closest?.url ?? screen ?? frames[0]?.url ?? receiptLink,
          label: `${rule} · ${title} · ${name}`, detail: annotation, priority: 0 });
      }
      for (const violation of sizeViolations) {
        alerts.push({ id, evidence: screen ?? receiptLink,
          label: `SIZE/${violation.severity} · ${title} · ${name}`,
          detail: `${violation.label}: expected ${violation.expected}, actual ${violation.actual}`, priority: 0 });
      }
      const observedRules = new Set(step.report?.observedRules ?? []);
      const details = `Route ${step.report?.route ?? 'unreported'} · Observed ${layoutRules.filter(rule => observedRules.has(rule)).join(', ') || 'none'}`;
      markdown.push(`- **${escapeMarkdown(name)}** · ${escapeMarkdown(details)}${screen ? ` · [Screenshot](${screen})` : ''}`);
      if (frames.length > 0) markdown.push(`  - Transition frames · ${frames.map(({ url, timestampMs }) => `[${timestampMs} ms](${url})`).join(' · ')}`);
      if (transitions.length > 0) markdown.push(`  - Transition rules observed · ${[...new Set(transitions.flatMap(report => report.observedRules ?? []))].join(', ') || 'none'}`);
      for (const { rule, detail } of violations) markdown.push(`  - ${rule} · ${escapeMarkdown(detail)}`);
      if (sizeChecks.length > 0) {
        if (sizeViolations.length > 0) {
          for (const v of sizeViolations) {
            markdown.push(`  - SIZE/${escapeMarkdown(v.severity)} · ${escapeMarkdown(v.label)} · expected \`${escapeMarkdown(v.expected)}\`, actual \`${escapeMarkdown(v.actual)}\``);
          }
        } else {
          markdown.push(`  - Size budget (${escapeMarkdown(stepSizeAudit.screen ?? 'auto')}): PASS (${sizeChecks.length} checks)`);
        }
      }
      const strip = frames.length > 0 ? `<div class="filmstrip" aria-label="Chronological transition frames">${frames.map(({ url, timestampMs }) =>
        `<figure${suspectFrames.has(url) ? ' class="suspect"' : ''}>${imageLink(url, `${name}, ${timestampMs} ms`)}
<figcaption>${timestampMs} ms${suspectFrames.has(url) ? ' · near reported frame' : ''}</figcaption></figure>`).join('')}</div>` :
        transitions.length > 0 ? '<p>No transition screenshots. See the journey receipt for frame telemetry.</p>' : '';
      const sizeTable = sizeChecks.length > 0 ? `<table class="size-table"><thead><tr><th>Target</th><th>Expected</th><th>Measured</th><th>Status</th></tr></thead><tbody>${sizeChecks.map(c =>
        `<tr class="${c.passed ? 'ok' : 'bad'}"><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.expected)}</td><td>${escapeHtml(c.actual)}</td><td>${c.passed ? 'PASS' : escapeHtml(c.severity)}</td></tr>`).join('')}</tbody></table>` : '';
      cards.push(`<article id="${id}">${screen ? imageLink(screen, name) : ''}
<h3>${escapeHtml(name)}</h3><p>${escapeHtml(details)}</p><div class="rules">${marks(layoutRules, reports, violations)}</div>
${transitions.length > 0 || frames.length > 0 ? `<div class="rules transition">${marks(transitionRules, transitions, violations)}</div>` : ''}
${strip}
${violations.length > 0 ? `<ul>${violations.map(({ rule, detail }) => `<li><strong>${rule}</strong> ${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}
${sizeTable}</article>`);
    }
    if (receipt.status !== 'PASS' && (receipt.failure || !receipt.blockers?.length)) {
      const capturedFile = receipt.failure?.screenCap?.file ?? receipt.failure?.capture?.file;
      const evidence = (capturedFile && relativeUrl(directory, capturedFile)) ?? receiptLink;
      const detail = receipt.failure?.message ?? receipt.failure?.error ?? receipt.reason ?? '';
      alerts.push({ id: sectionId, evidence, label: failedCheckpoint ? `${title} · ${failedCheckpoint}` : title, detail, priority: 1 });
    }
    if (cards.length === 0) markdown.push('No checkpoint screenshots or transition evidence.');
    if (coverage.length > 0) {
      markdown.push('', 'External coverage');
      for (const item of coverage) markdown.push(`- ${escapeMarkdown(item)}`);
    }
    markdownSections.push(...markdown, '');
    sections.push(`<section id="${sectionId}"><h2>${escapeHtml(title)}</h2>
${receiptLink ? `<p><a href="${escapeHtml(receiptLink)}">Journey receipt</a></p>` : ''}
${cards.length > 0 ? `<div class="grid">${cards.join('\n')}</div>` : '<p>No checkpoint screenshots or transition evidence.</p>'}
${coverage.length > 0 ? `<h3>External coverage</h3><ul>${coverage.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</section>`);
  }
  alerts.sort((left, right) => left.priority - right.priority);
  const markdown = ['# VM visual review', ''];
  if (alerts.length > 0) {
    markdown.push('## Alerts', '');
    for (const { evidence, label, detail } of alerts) {
      markdown.push(`- **${escapeMarkdown(label)}**${detail ? ` · ${escapeMarkdown(detail)}` : ''}${evidence ? ` · [Evidence](${evidence})` : ''}`);
    }
    markdown.push('');
  }
  markdown.push(...markdownSections);
  const summary = alerts.length > 0 ? `<section class="alerts"><h2>Alerts</h2><ul>${alerts.map(({ id, evidence, label, detail }) =>
    `<li><a href="#${id}">${escapeHtml(label)}</a>${detail ? ` · ${escapeHtml(detail)}` : ''}${evidence ? ` · <a href="${escapeHtml(evidence)}">Evidence</a>` : ''}</li>`).join('')}</ul></section>` : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VM visual review</title>
<style>
  :root { color-scheme: light dark; font: 16px system-ui, sans-serif; }
  body { max-width: 90rem; margin: 2rem auto; padding: 0 1rem; }
  section { margin: 2rem 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }
  article { border: 1px solid GrayText; border-radius: .5rem; padding: 1rem; min-width: 0; }
  img { display: block; width: 100%; height: 24rem; object-fit: contain; }
  h3 { margin-bottom: 0; }
  article p { margin: .5rem 0; }
  .rules { display: flex; flex-wrap: wrap; gap: .3rem; }
  .rules span { border: 1px solid currentColor; border-radius: .3rem; padding: .1rem .35rem; font-size: .8rem; }
  .observed { color: #fff; background: #255b44; }
  .violation { color: #fff; background: #a4162d; }
  .unobserved { color: GrayText; }
  .alerts { border-inline-start: .25rem solid #be2943; padding-inline-start: .8rem; }
  .transition { margin-block-start: .4rem; }
  .filmstrip { display: flex; overflow-x: auto; gap: .5rem; margin-block-start: .7rem; }
  .filmstrip figure { margin: 0; flex: 0 0 8rem; text-align: center; }
  .filmstrip .suspect { outline: 2px solid #be2943; outline-offset: -2px; }
  .filmstrip img { height: 12rem; }
  .size-table { width: 100%; border-collapse: collapse; margin-top: .6rem; font-size: .78rem; }
  .size-table th, .size-table td { border-bottom: 1px solid GrayText; padding: .25rem .35rem; text-align: left; }
  .size-table tr.bad td { color: #ff8b8b; font-weight: 600; }
</style></head><body>
<h1>VM visual review</h1>
${summary}
${sections.join('\n')}
</body></html>
`;
  return { markdown: markdown.join('\n'), html };
}
