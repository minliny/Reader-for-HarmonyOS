// RulePipelineFacade - Phase 2 ArkTS Runtime Facade。
// 调度 CSS/XPath/JSONPath/template/regex 规则求值，输出 Core-compatible stage report。
//
// 对齐 Core: ReaderCoreParser NonJSParserEngine 契约语义（clean-room，不复制实现）。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import { MarkupParserAdapter, MarkupNode } from '../adapters/MarkupParserAdapter';
import {
  HARMONYOS_PLATFORM_FAMILY,
  RuntimeStageReport,
  StageReportStatus,
  createStageReport,
  passedCase,
  unsupportedCase
} from './RuntimeStageReport';

export interface RulePipelineRequest {
  ruleKind: 'css' | 'xpath' | 'jsonpath' | 'template' | 'regex';
  ruleExpression: string;
  input: string;
  baseURL?: string;
}

export interface RulePipelineResult {
  values: string[];
  matchedCount: number;
  diagnostics: string[];
}

export interface RulePipelineStageReport extends RuntimeStageReport {
  facadeIdentifier: 'RulePipelineFacade';
  stageName: 'rule_pipeline';
}

const FACADE_ID = 'RulePipelineFacade';
const STAGE_NAME = 'rule_pipeline';

export class RulePipelineFacade {
  private markup: MarkupParserAdapter;

  constructor() {
    this.markup = new MarkupParserAdapter();
  }

  evaluate(request: RulePipelineRequest): RulePipelineResult {
    switch (request.ruleKind) {
      case 'css':
        return this.evaluateCSS(request);
      case 'xpath':
        return this.evaluateXPath(request);
      case 'jsonpath':
        return this.evaluateJSONPath(request);
      case 'template':
        return this.evaluateTemplate(request);
      case 'regex':
        return this.evaluateRegex(request);
      default:
        return { values: [], matchedCount: 0, diagnostics: [`unsupported rule kind:${request.ruleKind}`] };
    }
  }

  buildStageReport(): RulePipelineStageReport {
    const cases = [
      this.cssCase(),
      this.xpathCase(),
      this.jsonPathCase(),
      this.templateCase(),
      this.regexCase()
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as RulePipelineStageReport;
  }

  private evaluateCSS(request: RulePipelineRequest): RulePipelineResult {
    const root = this.markup.parse(request.input);
    const nodes = this.markup.queryCss(root, request.ruleExpression);
    const values = nodes.map((n: MarkupNode) => n.text);
    return { values, matchedCount: nodes.length, diagnostics: [] };
  }

  private evaluateXPath(request: RulePipelineRequest): RulePipelineResult {
    const root = this.markup.parse(request.input);
    const nodes = this.markup.queryXPath(root, request.ruleExpression);
    const values = nodes.map((n: MarkupNode) => n.text);
    return { values, matchedCount: nodes.length, diagnostics: [] };
  }

  private evaluateJSONPath(request: RulePipelineRequest): RulePipelineResult {
    // 简化 JSONPath：支持 $.field.subfield 点路径
    try {
      const obj: Record<string, Object> = JSON.parse(request.input) as Record<string, Object>;
      const path = request.ruleExpression.replace(/^\$\.?/, '');
      const parts = path.split('.');
      let current: Record<string, Object> = obj;
      for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        if (key.length === 0) { continue; }
        if (current[key] !== undefined && current[key] !== null) {
          current = current[key] as Record<string, Object>;
        } else {
          return { values: [], matchedCount: 0, diagnostics: [`jsonpath miss at:${key}`] };
        }
      }
      const value = current === null || current === undefined ? '' : String(current);
      return { values: [value], matchedCount: 1, diagnostics: [] };
    } catch (e) {
      return { values: [], matchedCount: 0, diagnostics: [`jsonpath parse error`] };
    }
  }

  private evaluateTemplate(request: RulePipelineRequest): RulePipelineResult {
    // 简化 template：{{field}} 替换
    try {
      const obj: Record<string, Object> = JSON.parse(request.input) as Record<string, Object>;
      let result = request.ruleExpression;
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const placeholder = `{{${key}}}`;
        const value = String(obj[key]);
        while (result.indexOf(placeholder) !== -1) {
          result = result.replace(placeholder, value);
        }
      }
      return { values: [result], matchedCount: 1, diagnostics: [] };
    } catch (e) {
      return { values: [], matchedCount: 0, diagnostics: [`template parse error`] };
    }
  }

  private evaluateRegex(request: RulePipelineRequest): RulePipelineResult {
    try {
      const regex = new RegExp(request.ruleExpression, 'g');
      const matches = request.input.match(regex);
      if (matches === null) {
        return { values: [], matchedCount: 0, diagnostics: [] };
      }
      return { values: matches.slice(), matchedCount: matches.length, diagnostics: [] };
    } catch (e) {
      return { values: [], matchedCount: 0, diagnostics: [`regex error`] };
    }
  }

  private cssCase() {
    const html = '<html><body><p class="body">Text</p></body></html>';
    const result = this.evaluate({ ruleKind: 'css', ruleExpression: '.body', input: html });
    const passed = result.matchedCount > 0;
    return passed ?
      passedCase(FACADE_ID, STAGE_NAME, 'css', `css matches:${result.matchedCount}`) :
      unsupportedCase(FACADE_ID, STAGE_NAME, 'css', 'css evaluation failed');
  }

  private xpathCase() {
    const xml = '<root><item>One</item><item>Two</item></root>';
    const result = this.evaluate({ ruleKind: 'xpath', ruleExpression: '//item', input: xml });
    const passed = result.matchedCount > 0;
    return passed ?
      passedCase(FACADE_ID, STAGE_NAME, 'xpath', `xpath matches:${result.matchedCount}`) :
      unsupportedCase(FACADE_ID, STAGE_NAME, 'xpath', 'xpath evaluation failed');
  }

  private jsonPathCase() {
    const json = '{"title":"Fixture","author":"Reader"}';
    const result = this.evaluate({ ruleKind: 'jsonpath', ruleExpression: '$.title', input: json });
    const passed = result.matchedCount === 1 && result.values[0] === 'Fixture';
    return passed ?
      passedCase(FACADE_ID, STAGE_NAME, 'jsonpath', `jsonpath value:${result.values[0]}`) :
      unsupportedCase(FACADE_ID, STAGE_NAME, 'jsonpath', 'jsonpath evaluation failed');
  }

  private templateCase() {
    const json = '{"name":"Reader","version":"1.0"}';
    const result = this.evaluate({ ruleKind: 'template', ruleExpression: '{{name}}-{{version}}', input: json });
    const passed = result.matchedCount === 1 && result.values[0] === 'Reader-1.0';
    return passed ?
      passedCase(FACADE_ID, STAGE_NAME, 'template', `template result:${result.values[0]}`) :
      unsupportedCase(FACADE_ID, STAGE_NAME, 'template', 'template evaluation failed');
  }

  private regexCase() {
    const result = this.evaluate({ ruleKind: 'regex', ruleExpression: '\\d+', input: 'abc123def456' });
    const passed = result.matchedCount === 2;
    return passed ?
      passedCase(FACADE_ID, STAGE_NAME, 'regex', `regex matches:${result.matchedCount}`) :
      unsupportedCase(FACADE_ID, STAGE_NAME, 'regex', 'regex evaluation failed');
  }
}
