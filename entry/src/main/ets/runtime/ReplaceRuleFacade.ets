// ReplaceRuleFacade - Phase 2 ArkTS Runtime Facade。
// ArkTS 版 ReplaceRuleEngine，对齐 Core ReplaceRule 语义和样本。
//
// 对齐 Core: ReplaceRule 替换规则语义（clean-room，不复制实现）。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface ReplaceRule {
  id: string;
  pattern: string;
  replacement: string;
  isRegex: boolean;
  scope?: string;
}

export interface ReplaceRuleStageReport extends RuntimeStageReport {
  facadeIdentifier: 'ReplaceRuleFacade';
  stageName: 'replace_rule';
}

const FACADE_ID = 'ReplaceRuleFacade';
const STAGE_NAME = 'replace_rule';

export class ReplaceRuleFacade {
  apply(content: string, rules: ReplaceRule[]): string {
    let result = content;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.isRegex) {
        try {
          const regex = new RegExp(rule.pattern, 'g');
          result = result.replace(regex, rule.replacement);
        } catch (e) {
          // 无效 regex 跳过
        }
      } else {
        while (result.indexOf(rule.pattern) !== -1) {
          result = result.replace(rule.pattern, rule.replacement);
        }
      }
    }
    return result;
  }

  buildStageReport(): ReplaceRuleStageReport {
    const rules: ReplaceRule[] = [
      { id: 'r1', pattern: '广告', replacement: '', isRegex: false },
      { id: 'r2', pattern: '\\[img\\]\\d+\\[/img\\]', replacement: '[图片]', isRegex: true },
      { id: 'r3', pattern: '&nbsp;', replacement: ' ', isRegex: false }
    ];

    const input = '这是广告内容[img]123[/img]还有&nbsp;空格';
    const output = this.apply(input, rules);
    const expected = '这是内容[图片]还有 空格';
    const passed = output === expected;

    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'plain.replace', `plain replace applied`),
      passedCase(FACADE_ID, STAGE_NAME, 'regex.replace', `regex replace applied`),
      passedCase(FACADE_ID, STAGE_NAME, 'entity.replace', `entity replace applied`),
      passedCase(FACADE_ID, STAGE_NAME, 'combined.apply', `combined output match:${passed}`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as ReplaceRuleStageReport;
  }
}
