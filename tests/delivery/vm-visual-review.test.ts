import assert from 'node:assert/strict';
import test from 'node:test';
import { renderVisualReview } from '../../scripts/lib/vm-visual-review.mjs';

test('visual review links stable captures and labels the fourteen layout rules', () => {
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
  assert.equal((html.match(/aria-label="R\d+ /g) ?? []).length, 14);
  for (const output of [markdown, html]) {
    assert.match(output, /J2 · FAIL · 1 s/);
    assert.match(output, /J3 · NOT\\?_RUN/);
    assert.doesNotMatch(output, /Restore normal input|J3\/receipt\.json|https?:\/\//);
  }
});

test('visual review puts rule failures first and renders real transition captures in time order', () => {
  const { markdown, html } = renderVisualReview([
    { journey: 'J8', status: 'NOT_RUN', reason: 'Window profile needs a configured device' },
    { journey: 'J9', status: 'FAIL', relativeDirectory: 'material-native/J9', profile: { id: 'material-native' },
      steps: [
        { step: 'Start TTS', report: { route: 'detail', violations: [{ rule: 'R13', detail: 'waveform clip' }] },
          screenCap: { file: 'stable.png' }, transition: [{
            observedRules: ['T3'], violations: [{ rule: 'T3', code: 'source-and-proxy-visible', frame: 0 }], frames: [{ atMs: 25 }],
          }],
          transitionCaptures: [
            { file: 'second.png', timestampMs: 80 },
            { file: 'first (native).png', timestampMs: 20 },
            { file: '../outside.png', timestampMs: 1 },
          ] },
        { step: 'Return to body', transition: [{ observedRules: ['T2'], violations: [] }] },
      ] },
  ]);
  for (const output of [markdown, html]) {
    assert.ok(output.indexOf('R13 ·') < output.indexOf('J8 ·'));
    assert.ok(output.lastIndexOf('first%20%28native%29.png') < output.lastIndexOf('second.png'));
    assert.match(output, /source-and-proxy-visible/);
    assert.doesNotMatch(output, /outside\.png/);
  }
  assert.match(html, /aria-label="T3 violation"/);
  assert.match(html, /aria-label="R13 violation"/);
  assert.match(html, /No transition screenshots/);
  assert.match(html, /20 ms · near reported frame/);
  assert.match(markdown, /\[Evidence\]\(material-native\/J9\/stable.png\)/);
});

test('blocked device steps retain their concrete missing prerequisites in the alert list', () => {
  const blocker = { step: 'Open system provider', reason: 'Public document fixture unavailable' };
  const externalCoverage = [{ step: 'Recipient delivery', status: 'NOT_RUN', reason: 'No attached receiver' }];
  const receipts = [{ journey: 'J14', status: 'BLOCKED', blockers: [blocker],
    steps: [{ ...blocker, status: 'BLOCKED' }], externalCoverage }];
  const { markdown, html } = renderVisualReview(receipts);
  for (const output of [markdown, html]) {
    assert.match(output, /Open system provider.*Public document fixture unavailable/);
    assert.match(output, /Recipient delivery · NOT\\?_RUN · No attached receiver/);
  }
});
