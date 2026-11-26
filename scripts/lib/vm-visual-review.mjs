const rules = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const escapeMarkdown = value => escapeHtml(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]|]/g, '\\$&');
const relativeUrl = (...parts) => parts.join('/').split('/').map(encodeURIComponent).join('/');
const duration = receipt => receipt.seconds === undefined ? '' : ` · ${receipt.seconds} s`;

export function renderVisualReview(receipts) {
  const markdown = ['# VM visual review', '', 'Observed rules are listed at each screenshot. See the journey receipt for all checkpoints.', ''];
  const sections = [];
  for (const receipt of receipts) {
    const title = `${receipt.journey} · ${receipt.status}${duration(receipt)}`;
    const receiptLink = receipt.steps ? relativeUrl(receipt.journey, 'receipt.json') : undefined;
    const screenshots = (receipt.steps ?? []).filter(step => step.screenCap);
    markdown.push(`## ${escapeMarkdown(title)}`, '');
    if (receiptLink) markdown.push(`[Journey receipt](${receiptLink})`, '');
    if (screenshots.length === 0) markdown.push('No checkpoint screenshots.', '');
    const cards = [];
    for (const step of screenshots) {
      const route = step.report.route;
      const observed = new Set(step.report.observedRules);
      const image = relativeUrl(receipt.journey, step.screenCap.file);
      const details = `Route ${route} · Observed ${rules.filter(rule => observed.has(rule)).join(', ') || 'none'}`;
      markdown.push(`- **${escapeMarkdown(step.step)}** · ${escapeMarkdown(details)} · [Screenshot](${image})`);
      const marks = rules.map(rule => {
        const state = observed.has(rule) ? 'observed' : 'unobserved';
        return `<span class="${state}" title="${rule} ${state}" aria-label="${rule} ${state}">${rule}</span>`;
      }).join('');
      cards.push(`<article><a href="${escapeHtml(image)}"><img src="${escapeHtml(image)}" loading="lazy" alt="${escapeHtml(step.step)}"></a>
<h3>${escapeHtml(step.step)}</h3><p>Route ${escapeHtml(route)}</p><div class="rules">${marks}</div></article>`);
    }
    if (screenshots.length > 0) markdown.push('');
    sections.push(`<section><h2>${escapeHtml(title)}</h2>
${receiptLink ? `<p><a href="${escapeHtml(receiptLink)}">Journey receipt</a></p>` : ''}
${cards.length > 0 ? `<div class="grid">${cards.join('\n')}</div>` : '<p>No checkpoint screenshots.</p>'}</section>`);
  }
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VM visual review</title>
<style>
  :root { color-scheme: light dark; font: 16px system-ui, sans-serif; }
  body { max-width: 90rem; margin: 2rem auto; padding: 0 1rem; }
  section { margin: 2rem 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }
  article { border: 1px solid GrayText; border-radius: .5rem; padding: 1rem; }
  img { display: block; width: 100%; height: 24rem; object-fit: contain; }
  h3 { margin-bottom: 0; }
  article p { margin: .5rem 0; }
  .rules { display: flex; flex-wrap: wrap; gap: .3rem; }
  .rules span { border: 1px solid currentColor; border-radius: .3rem; padding: .1rem .35rem; font-size: .8rem; }
  .observed { color: #fff; background: #255b44; }
  .unobserved { color: GrayText; }
</style></head><body>
<h1>VM visual review</h1>
<p>Filled rule markers indicate observations. Open a screenshot to view the original.</p>
${sections.join('\n')}
</body></html>
`;
  return { markdown: markdown.join('\n'), html };
}
