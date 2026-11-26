import assert from 'node:assert/strict';
import test from 'node:test';
import { renderVisualReview } from '../../scripts/lib/vm-visual-review.mjs';

test('visual review links stable captures and labels all seven measured or unmeasured rules', () => {
  const { markdown, html } = renderVisualReview([
    {
      journey: 'J1', status: 'PASS', seconds: 3.25,
      steps: [
        { step: 'Shelf [cover] <ready>', report: { route: 'bookshelf', observedRules: ['R7', 'R1'] },
          screenCap: { file: 'shelf cover.png' } },
        { step: 'Restore normal input', report: { route: 'bookshelf', observedRules: ['R5', 'R6'] } },
      ],
    },
    { journey: 'J2', status: 'FAIL', seconds: 1, steps: [] },
    { journey: 'J3', status: 'NOT_RUN' },
  ]);

  assert.match(markdown, /J1 · PASS · 3\.25 s/);
  assert.match(markdown, /Route bookshelf · Observed R1, R7/);
  assert.ok(markdown.includes('[Screenshot](J1/shelf%20cover.png)'));
  assert.ok(markdown.includes('[Journey receipt](J1/receipt.json)'));
  assert.match(html, /<a href="J1\/shelf%20cover\.png"><img src="J1\/shelf%20cover\.png"/);
  assert.match(html, /Shelf \[cover\] &lt;ready&gt;/);
  assert.match(html, /R7 observed/);
  assert.match(html, /R6 unobserved/);
  assert.equal((html.match(/aria-label="R[1-7] /g) ?? []).length, 7);
  for (const output of [markdown, html]) {
    assert.match(output, /J2 · FAIL · 1 s/);
    assert.match(output, /J3 · NOT\\?_RUN/);
    assert.doesNotMatch(output, /Restore normal input|J3\/receipt\.json|https?:\/\//);
  }
});
