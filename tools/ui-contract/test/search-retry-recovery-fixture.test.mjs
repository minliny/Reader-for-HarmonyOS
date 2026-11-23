import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRetryRecoveryFixture } from '../fixtures/search-retry-recovery/fixture.mjs';

const fixtureDir = new URL('../fixtures/search-retry-recovery/', import.meta.url);
const plan = JSON.parse(readFileSync(new URL('fixture-plan.json', fixtureDir), 'utf8'));
const origin = 'https://retry-fixture.example';
const runId = '00000000-0000-4000-8000-000000000001';
const otherRunId = '00000000-0000-4000-8000-000000000002';
const before = { initialPage1:0, recoveredPage1:0, recoveredPage2:0 };

test('Phase 1 retry recovery fixture serves its pinned responses only on the current run routes', () => {
  for (const invalidOrigin of ['http://retry-fixture.example', origin + '/', origin + '/path', origin + '?q=1']) {
    assert.throws(() => createRetryRecoveryFixture({origin:invalidOrigin,runId}), /canonical HTTPS origin/u);
  }
  assert.throws(() => createRetryRecoveryFixture({origin,runId:'../malformed'}), /UUIDv4/u);
  assert.equal(plan.schema,'reader-phase1-search-retry-recovery-fixture-v1');
  assert.equal(plan.configuredOrigin,null);
  const fixture = createRetryRecoveryFixture({origin,runId});
  const other = createRetryRecoveryFixture({origin,runId:otherRunId});
  const materialized = JSON.parse(fixture.sourceImport);
  const template = JSON.parse(readFileSync(new URL(plan.sourceTemplate.path,fixtureDir),'utf8'));
  const base = `${origin}/reader-phase1/retry-recovery/${runId}/`;
  assert.deepEqual(materialized,[{...template[0],bookSourceUrl:base}]);
  assert.deepEqual(materialized[0].ruleSearch,{bookList:'$.books[*]',name:'$.title',author:'$.author',bookUrl:'$.url'});
  assert.equal(materialized[0].enabled,true);
  assert.equal(materialized[0].enabledCookieJar,false);
  assert.equal(materialized[0].enabledExplore,false);
  assert.equal(plan.localBookTitle,'Reader Phase 1 公共长目录');
  assert.equal(plan.query,'公共长目录');
  assert.equal(plan.onlineBookTitle,'Reader Phase 1 公共长目录（重试恢复）');

  const page1 = new URL(materialized[0].searchUrl.replace('{{page}}',1),base).pathname;
  const page2 = new URL(materialized[0].searchUrl.replace('{{page}}',2),base).pathname;
  assert.equal(page1,`/reader-phase1/retry-recovery/${runId}/search/retry-recovery/1.json`);
  assert.equal(page2,`/reader-phase1/retry-recovery/${runId}/search/retry-recovery/2.json`);
  const sourceImport = fixture.sourceImport;

  function verifyResponse(response, name, status, expected) {
    const planned = plan.responses[name];
    assert.equal(response.status,status);
    assert.equal(response.status,planned.status);
    assert.deepEqual(response.headers,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    assert.deepEqual(response.body,readFileSync(new URL(planned.path,fixtureDir)));
    assert.equal(response.body.byteLength,planned.bytes);
    const sha256 = createHash('sha256').update(response.body).digest('hex');
    assert.equal(sha256,planned.sha256);
    assert.equal(response.sha256,sha256);
    assert.deepEqual(JSON.parse(response.body.toString('utf8')),expected);
  }

  assert.equal(fixture.respond('HEAD',page1),null);
  assert.equal(fixture.respond('POST',page1),null);
  assert.equal(fixture.respond('GET',page1 + '?unrelated'),null);
  assert.equal(fixture.respond('GET',page1.replace('/1.json','/%31.json')),null);
  assert.equal(fixture.respond('GET',page1.replace(runId,otherRunId)),null);
  assert.equal(other.respond('GET',page1),null);
  assert.equal(fixture.respond('GET',page2),null);
  assert.deepEqual(fixture.snapshot(),before);
  assert.deepEqual(other.snapshot(),before);
  verifyResponse(fixture.respond('GET',page1),'initialPage1',503,{status:'fixture-unavailable'});
  assert.equal(fixture.respond('GET',page2),null);
  assert.deepEqual(fixture.snapshot(),{...before,initialPage1:1});

  const recovered = fixture.respond('GET',page1);
  const positive = {books:[{title:plan.onlineBookTitle,author:'Public Fixture',url:'/catalog/retry-recovered'}]};
  verifyResponse(recovered,'recoveredPage1',200,positive);
  verifyResponse(fixture.respond('GET',page2),'recoveredPage2',200,{books:[]});
  assert.deepEqual(fixture.snapshot(),{initialPage1:1,recoveredPage1:1,recoveredPage2:1});
  assert.equal(fixture.sourceImport,sourceImport);
  recovered.body.fill(0);
  recovered.headers['cache-control'] = 'mutable caller copy';
  verifyResponse(fixture.respond('GET',page1),'recoveredPage1',200,positive);
  assert.deepEqual(fixture.snapshot(),{initialPage1:1,recoveredPage1:2,recoveredPage2:1});
  assert.deepEqual(other.snapshot(),before);
  verifyResponse(other.respond('GET',page1.replace(runId,otherRunId)),'initialPage1',503,{status:'fixture-unavailable'});
});
