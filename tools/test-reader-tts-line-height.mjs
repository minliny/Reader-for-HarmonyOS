import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionClasses, selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles, readerMessageStyles } from './lib/reader-typography-probe.mjs';

const cases = { 'narrow-large-text': { description: 'Measured TTS presentation uses the painted line heights at 2x, including no-snapshot fallback', resources: [] } };
for (const id of selectContractCases(cases)) {
  await lineHeightBudget();
  recordContractCasePass(id);
}

async function lineHeightBudget() {
  const root = new URL('../', import.meta.url);
  const sourceRoot = 'entry/src/main/ets/';
  const ui = sourceRoot + 'features/reading/ui/';
  const readSource = path => readFileSync(new URL(path, root), 'utf8');
  const hook = registerHooks({
    resolve(specifier, context, next) {
      try { return next(specifier, context); }
      catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
          return next(specifier + '.ts', context);
        }
        throw error;
      }
    },
  });

  const minimumSource = readSource(ui + 'ReaderControlTtsMinimum.ets');
  const measurementSource = readSource(ui + 'ReaderControlTextMeasurement.ets');
  const typographyPath = sourceRoot + 'ui/foundation/ReaderTypography.ets';
  const inputModules = await Promise.all([
    sourceRoot + 'features/reading/application/ReaderTtsState.ts',
    sourceRoot + 'features/reading/presentation/ReaderTtsConfigOptions.ts',
    ui + 'ReaderControlPlaybackGeometry.ts',
    ui + 'ReaderControlActorGeometry.ts',
  ].map(relative => import(new URL(relative, root)))).finally(() => hook.deregister());

  const classes = selectedProductionClasses(new URL(typographyPath, root), ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
  const measure = pureModuleProbe(measurementSource, 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const dependencies = Object.assign({}, readerFoundationTokens, readerTypographyRoles, readerMessageStyles,
    classes, measure, ...inputModules);
  const compile = source => pureModuleProbe(source, 'ReaderControlTtsMinimum.ets', dependencies,
    ['readerControlTtsMinimumFacts', 'measureReaderTtsMinimum']);

  function measurementPort(scale, naturalLineFactor) {
    const requests = [];
    const advance = options => [...options.textContent].reduce((sum, character) =>
      sum + (/\p{Script=Han}/u.test(character) ? 1 : 0.55), 0) * Number.parseFloat(options.fontSize) * scale;
    const lineHeight = options => Number.parseFloat(options.lineHeight ?? options.fontSize) * scale *
      (options.lineHeight === undefined ? naturalLineFactor : 1);
    return {
      requests,
      context: {
        px2vp: value => value,
        getMeasureUtils: () => ({
          measureText: advance,
          measureTextSize(options) {
            requests.push(options);
            const width = advance(options);
            const lines = options.maxLines === 1 ? 1 : Math.max(1, Math.ceil(width / (options.constraintWidth ?? 220)));
            return { width: Math.min(width, options.constraintWidth ?? 220), height: lineHeight(options) * lines };
          },
        }),
      },
    };
  }

  const widths = { panelWidthVp: 246, quickContentWidthVp: 168, fullContentWidthVp: 220 };
  const { readerControlTtsMinimumFacts, measureReaderTtsMinimum } = compile(minimumSource);
  const state = inputModules[0].createReaderTtsState(true);
  const facts = readerControlTtsMinimumFacts({
    state, timerMode: 'off', timerMinutes: 0, timerSeconds: 0, failurePolicy: 'stop', allowMixing: false,
    engine: 'system', httpEngines: [{ id: 1, name: 'Current service' }], voiceOptions: [],
    language: 'zh-CN', person: 0, ratePreview: -1, serviceTab: 'online',
  });
  const port = measurementPort(2, 1.2);
  const profile = measureReaderTtsMinimum(port.context, widths, facts);
  assert.ok(profile);
  for (const [text, expected] of [
    ['定时', '18fp'], ['当前音色 · ' + facts.voice, '16fp'],
    [facts.failureValue, '16fp'], [facts.manageLabel, '16fp'],
    [Array.from(facts.playbackLabel)[0] + '…', '13fp'],
  ]) {
    const requests = port.requests.filter(request => request.textContent === text);
    assert.ok(requests.length > 0, text);
    assert.ok(requests.every(request => request.lineHeight === expected), `${text}: measure the painted line box`);
  }
  assert.equal(profile.quickText.quickSettingTitle, 36);
  assert.ok(profile.fullText.manageButton >= 40);
  const Content = selectedProductionMethods(new URL(ui + 'ReaderControlTtsContent.ets', root), 'ReaderControlTtsContent',
    ['fieldHeight'], readerTypographyRoles);
  const content = Object.assign(new Content(), {
    textMinimum: () => undefined, fieldValue: () => '中文',
    getUIContext: () => port.context,
  });
  assert.equal(content.fieldHeight('voice'), 40);
  assert.equal(port.requests.at(-1).lineHeight, '16fp');
}
