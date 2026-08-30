import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// ArkTS uses extensionless relative imports. Let this Node-only test resolve
// those imports to their real TypeScript files without changing production
// module specifiers or adding a bundler.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) &&
        !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  classifyChapterBody,
  isRemoteSourceFailureKind,
  remoteReadingFailureKindOf,
  RemoteContentAdmission,
  RemoteReadingSourceError,
  verdictForFailureKind,
} = await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const {
  RemoteReadingFlowGateway,
} = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const {
  RemoteReadingGatewayError,
} = await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');

const longRealBody = '山间的风掠过竹林，带来一阵沙沙的响声。'.repeat(30);

// 1. classifyChapterBody: readable vs placeholder families.
assert.deepEqual(classifyChapterBody(longRealBody), { kind: 'readable' },
  'a real chapter body is readable');
assert.equal(classifyChapterBody('   \n\t  ').kind, 'SOURCE_CONTENT_EMPTY',
  'a blank body is content-empty');
assert.equal(classifyChapterBody('短').kind, 'SOURCE_CONTENT_EMPTY',
  'a body below the minimum length is content-empty');
assert.equal(classifyChapterBody('章节内容正在加载，请稍候...').kind, 'SOURCE_CONTENT_EMPTY',
  'a loading placeholder is content-empty');
assert.equal(classifyChapterBody('内容不存在或已被删除').kind, 'SOURCE_CONTENT_EMPTY',
  'a missing-content banner is content-empty');

// A long real body that merely mentions banner words is not misclassified.
assert.deepEqual(
  classifyChapterBody(`他打开充值页面看了一眼，随即关掉。${longRealBody}`),
  { kind: 'readable' },
  'a long real body is not misclassified by banner words');

// 2. classifyChapterBody: paywall / auth / captcha / HTML families.
assert.equal(classifyChapterBody('本章为VIP章节，订阅本章后即可阅读').kind, 'SOURCE_PAYWALL',
  'a purchase placeholder is a paywall');
assert.equal(classifyChapterBody('本章未解锁，开通会员查看全部内容').kind, 'SOURCE_PAYWALL',
  'a membership banner is a paywall');
assert.equal(classifyChapterBody('请登录后继续阅读本章内容').kind, 'SOURCE_AUTH_REQUIRED',
  'a login wall is auth-required');
assert.equal(classifyChapterBody('检测到异常访问，请输入验证码').kind, 'SOURCE_AUTH_REQUIRED',
  'a captcha interstitial is auth-required');
assert.equal(classifyChapterBody('Just a moment... please verify you are human').kind,
  'SOURCE_AUTH_REQUIRED', 'an anti-crawler interstitial is auth-required');
assert.equal(classifyChapterBody(
  '<!DOCTYPE html><html><head><title>登录</title></head><body><form>用户登录</form></body></html>').kind,
  'SOURCE_AUTH_REQUIRED', 'a login HTML page is auth-required');
assert.equal(classifyChapterBody(
  '<!DOCTYPE html><html><head><title>Error</title></head><body><p>500</p></body></html>').kind,
  'SOURCE_PARSE_FAILED', 'a non-login HTML page is a parse failure');

// 3. remoteReadingFailureKindOf: taxonomy mapping.
assert.equal(remoteReadingFailureKindOf(new RemoteReadingSourceError('SOURCE_PAYWALL', 'x')),
  'SOURCE_PAYWALL', 'a typed source error keeps its kind');
const codeExpectations = [
  ['emptyToc', 'SOURCE_TOC_EMPTY'],
  ['invalidResponse', 'SOURCE_PARSE_FAILED'],
  ['identityMismatch', 'SOURCE_PARSE_FAILED'],
  ['missingTocUrl', 'SOURCE_PARSE_FAILED'],
  ['nonTextChapter', 'SOURCE_PARSE_FAILED'],
  ['chapterNotFound', 'SOURCE_PARSE_FAILED'],
  ['commandFailed', 'SOURCE_HTTP_FAILED'],
  ['chapterNotDownloaded', 'STORAGE_FAILED'],
  ['cachedSessionUnavailable', 'STORAGE_FAILED'],
  ['unsupportedHostCapability', 'RENDER_FAILED'],
  ['invalidInput', 'RENDER_FAILED'],
];
for (const [code, kind] of codeExpectations) {
  assert.equal(remoteReadingFailureKindOf(new RemoteReadingGatewayError(code, 'x')), kind,
    `${code} maps to ${kind}`);
}
assert.equal(remoteReadingFailureKindOf(new Error('some ui error')), 'RENDER_FAILED',
  'unknown errors never classify as source failures');

// 4. Only the six source kinds may offer a source switch.
for (const kind of [
  'SOURCE_HTTP_FAILED', 'SOURCE_PARSE_FAILED', 'SOURCE_TOC_EMPTY',
  'SOURCE_CONTENT_EMPTY', 'SOURCE_PAYWALL', 'SOURCE_AUTH_REQUIRED',
]) {
  assert.equal(isRemoteSourceFailureKind(kind), true, `${kind} may offer a source switch`);
}
for (const kind of ['PAGINATION_FAILED', 'LAYOUT_FAILED', 'RENDER_FAILED', 'STORAGE_FAILED']) {
  assert.equal(isRemoteSourceFailureKind(kind), false, `${kind} must never offer a source switch`);
}

// 5. verdictForFailureKind: detail-page verdict mapping.
assert.equal(verdictForFailureKind('SOURCE_HTTP_FAILED'), 'networkFailed');
assert.equal(verdictForFailureKind('SOURCE_PARSE_FAILED'), 'parseFailed');
assert.equal(verdictForFailureKind('SOURCE_TOC_EMPTY'), 'contentUnavailable');
assert.equal(verdictForFailureKind('SOURCE_CONTENT_EMPTY'), 'contentUnavailable');
assert.equal(verdictForFailureKind('SOURCE_PAYWALL'), 'paywalled');
assert.equal(verdictForFailureKind('SOURCE_AUTH_REQUIRED'), 'authRequired');
assert.equal(verdictForFailureKind('PAGINATION_FAILED'), 'contentUnavailable');

const SEED = {
  sourceId: 'source-1',
  bookId: '/book/42',
  detailUrl: '/book/42',
  title: 'Remote Book',
  author: 'Author',
};

function makeRuntime({ bodies, openSessionError, toc }) {
  return {
    requests: [],
    async request(method, params = {}, options = {}) {
      assert.equal(options.shouldCancel?.(), false);
      if (method === 'book.detail') {
        if (openSessionError !== undefined) {
          throw openSessionError;
        }
        return { data: {
          sourceId: params.sourceId,
          book: { bookId: params.bookUrl, title: 'Remote Book', author: 'Author' },
          tocUrl: '/book/42/toc',
        } };
      }
      if (method === 'book.toc') {
        return { data: {
          sourceId: params.sourceId,
          bookId: params.bookId,
          toc: toc ?? [
            { index: 0, title: 'Chapter 1', url: '/chapter/1' },
            { index: 1, title: 'Chapter 2', url: '/chapter/2' },
            { index: 2, title: 'Chapter 3', url: '/chapter/3' },
          ],
        } };
      }
      if (method === 'chapter.content') {
        const body = bodies[params.chapterIndex];
        if (typeof body === 'string') {
          return { data: {
            sourceId: params.sourceId,
            bookId: params.bookId,
            chapterTitle: `Chapter ${params.chapterIndex}`,
            content: body,
            via: 'rule',
          } };
        }
        throw body;
      }
      throw new Error(`unexpected command: ${method}`);
    },
    async loadReadingImage() {
      throw new Error('no image expected in this fixture');
    },
  };
}

async function verifyWith(runtime, seed = SEED) {
  const admission = new RemoteContentAdmission(new RemoteReadingFlowGateway(runtime));
  return admission.verify(seed, { isCurrent: () => true });
}

// 6. verify(): a readable leading chapter admits the session.
{
  const runtime = makeRuntime({ bodies: [longRealBody, longRealBody, longRealBody] });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'readable', 'a readable first chapter admits the book');
  assert.equal(outcome.readableChapterIndex, 0);
  assert.ok(outcome.session !== undefined, 'the admitted session is returned');
  assert.equal(outcome.session.identity.bookId, '/book/42');
}

// 7. verify(): a blank leading chapter is skipped; the next readable chapter wins.
{
  const runtime = makeRuntime({ bodies: ['正在加载中', '  ', longRealBody] });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'readable', 'a blank chapter 0 does not block admission');
  assert.equal(outcome.readableChapterIndex, 2,
    'the admitted readable chapter index is reported');
}

// 8. verify(): paywall/auth/captcha verdicts stop the probe immediately.
{
  const runtime = makeRuntime({ bodies: [new RemoteReadingSourceError('SOURCE_PAYWALL', 'buy')] });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'paywalled', 'a paywall chapter yields the paywalled verdict');
  assert.equal(outcome.readableChapterIndex, undefined);
  assert.ok(outcome.session !== undefined, 'the session still admits for detail display');
}
{
  const runtime = makeRuntime({ bodies: [new RemoteReadingSourceError('SOURCE_AUTH_REQUIRED', 'login')] });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'authRequired', 'a login wall yields the authRequired verdict');
}

// 9. verify(): every leading chapter blank => contentUnavailable.
{
  const runtime = makeRuntime({ bodies: ['正在加载中', '暂无内容', '内容不存在'] });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'contentUnavailable',
    'all-blank leading chapters yield contentUnavailable');
}

// 10. verify(): openSession failures map onto detail verdicts.
{
  const runtime = makeRuntime({ bodies: [], openSessionError: new Error('network unreachable') });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'networkFailed', 'an HTTP failure yields networkFailed');
  assert.equal(outcome.session, undefined);
}
{
  const runtime = makeRuntime({
    bodies: [],
    openSessionError: new RemoteReadingGatewayError('emptyToc', 'book.toc returned no readable chapters', 'book.toc'),
  });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'contentUnavailable', 'an empty TOC yields contentUnavailable');
}
{
  const runtime = makeRuntime({
    bodies: [],
    openSessionError: new RemoteReadingGatewayError('invalidResponse', 'book.toc returned invalid toc', 'book.toc'),
  });
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'parseFailed', 'a malformed envelope yields parseFailed');
}

// 11. loadChapter itself rejects a placeholder body with the typed source error.
{
  const runtime = makeRuntime({ bodies: ['请登录后继续阅读本章内容'] });
  const gateway = new RemoteReadingFlowGateway(runtime);
  const admission = new RemoteContentAdmission(gateway);
  const outcome = await admission.verify(SEED, { isCurrent: () => true });
  assert.equal(outcome.verdict, 'authRequired', 'the gateway-level rejection classifies as authRequired');
  let thrown = undefined;
  try {
    const session = await gateway.openSession(SEED, { isCurrent: () => true });
    await gateway.loadChapter(session, 0, () => true);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof RemoteReadingSourceError,
    'loadChapter throws the typed source error for a rejected body');
  assert.equal(thrown.kind, 'SOURCE_AUTH_REQUIRED');
  assert.equal(thrown.command, 'chapter.content');
}

// 12. loadChapter admits an image chapter with a short text body.
{
  const runtime = {
    async request(method, params = {}, options = {}) {
      assert.equal(options.shouldCancel?.(), false);
      if (method === 'book.detail') {
        return { data: {
          sourceId: params.sourceId,
          book: { bookId: params.bookUrl, title: 'Remote Book', author: 'Author' },
          tocUrl: '/book/42/toc',
        } };
      }
      if (method === 'book.toc') {
        return { data: {
          sourceId: params.sourceId,
          bookId: params.bookId,
          toc: [{ index: 0, title: 'Picture Chapter', url: '/chapter/pic' }],
        } };
      }
      assert.equal(method, 'chapter.content');
      return { data: {
        sourceId: params.sourceId,
        bookId: params.bookId,
        chapterTitle: 'Picture Chapter',
        content: '￼',
        blocks: [{ kind: 'image', source: 'images/a.webp', startScalar: 0, endScalar: 1 }],
        via: 'rule',
        http: { finalUrl: 'https://fixture.invalid/chapter/pic' },
      } };
    },
    async loadReadingImage() {
      return {
        pixelMap: 'pixel-map',
        fileUri: 'file:///fixture/body.png',
        width: 320,
        height: 180,
        revision: 'image-r1',
      };
    },
  };
  const outcome = await verifyWith(runtime);
  assert.equal(outcome.verdict, 'readable',
    'an image chapter with a minimal text body is admitted');
}

console.log('remote content admission contract: PASS');
