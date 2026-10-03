import assert from 'node:assert/strict';
import { countPrivateTypographyCalls } from './lib/architecture-private-typography-count.mjs';
import { isSharedTypographyExpression } from './lib/reader-typography-consumer-audit.mjs';
// The full CLI now requires the immutable whole-app registry and producer
// contracts. Exercise its exact carrier counter here; whole-app registration,
// imports and producer mutation negatives have their actual-source gates.
const file = 'entry/src/main/ets/features/probe/Probe.ets';
const run = expression => ({ status: countPrivateTypographyCalls(
  `@Component struct Probe { build() { Column() { Text('probe').fontSize(${expression}); } } }`, file) > 0 ? 1 : 0 });
  assert.equal(run('TYPE_FORM_ACTION.fontSizeFp').status, 0, 'real public consumer does not raise the old private budget');
  assert.notEqual(run('13').status, 0, 'direct private size rejected at unchanged zero budget');
  assert.notEqual(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : 13').status, 0, 'a TYPE substring cannot hide a private branch');
  assert.notEqual(run('TYPE_FORM_ACTION.fontSizeFp + 2').status, 0, 'private numeric role override rejected');
  assert.notEqual(run("'TYPE_FORM_ACTION.fontSizeFp'").status, 0, 'a string/comment is not a public role expression');
  assert.equal(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : TYPE_FORM_LABEL_ACTION.fontSizeFp').status, 0, 'bounded public variants accepted');
  assert.equal(isSharedTypographyExpression('TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96'), true);
assert.equal(countPrivateTypographyCalls("// Text('comment').fontSize(13);\n@Component struct Probe { build() { Column() {} } }",file),0,'ETS comments do not become production consumers');
  console.log('PASS private Typography budget: real public variants admitted; literals/mixed branches/string tricks/numeric overrides rejected; geometry/comments precise');
