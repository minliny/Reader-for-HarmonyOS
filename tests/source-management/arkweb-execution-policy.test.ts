import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arkWebEvaluationReady, arkWebUrlDisposition } from '../../entry/src/main/ets/platform/network/ArkWebAdmission.ts';

test('a denied subresource stays blocked without failing the admitted main document', () => {
  const host = 'reader.test';
  assert.equal(arkWebUrlDisposition('https://reader.test/style.css', host, false), 'allow');
  assert.equal(arkWebUrlDisposition('https://other.test/style.css', host, false), 'denyResource');
  assert.equal(arkWebUrlDisposition('https://other.test/', host, true), 'denyPage');
  assert.equal(arkWebUrlDisposition('https://reader.test/', undefined, false), 'denyResource');
});

test('ordinary ArkWeb evaluation admits an empty string after page readiness', () => {
  assert.equal(arkWebEvaluationReady(''), true);
  assert.equal(arkWebEvaluationReady(false), true);
  assert.equal(arkWebEvaluationReady(null), false);
});
