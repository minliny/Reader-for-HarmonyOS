import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export interface ManagedReplaceRule {
  id: number;
  name: string;
  pattern: string;
  replacement: string;
  isEnabled: boolean;
  isRegex: boolean;
  order: number;
}

export interface ManagedTxtTocRule {
  id: number;
  name: string;
  rule: string;
  example: string;
  enable: boolean;
  serialNumber: number;
}

export interface ManagedDictRule {
  name: string;
  urlRule: string;
  showRule: string;
  enabled: boolean;
  sortNumber: number;
}

export interface ManagedRuleSubscription {
  id: number;
  name: string;
  url: string;
  autoUpdate: boolean;
  customOrder: number;
}

export interface ReplaceRuleDraft {
  id?: number;
  name: string;
  pattern: string;
  replacement: string;
  isEnabled: boolean;
  isRegex: boolean;
  order: number;
}

export interface TxtTocRuleDraft {
  id?: number;
  name: string;
  rule: string;
  example: string;
  enable: boolean;
  serialNumber: number;
}

export interface DictRuleDraft {
  name: string;
  urlRule: string;
  showRule: string;
  enabled: boolean;
  sortNumber: number;
}

export interface RuleSubscriptionDraft {
  id?: number;
  name: string;
  url: string;
  autoUpdate: boolean;
  customOrder: number;
}

export interface RuleBundleExport {
  json: string;
  summary: string;
}

/** Typed boundary for the four Core-owned rule entity families. */
export class RulesManagementGateway {
  private readonly owner: ReaderRuntimeOwner;

  constructor(owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.owner = owner;
  }

  async listReplaceRules(): Promise<ManagedReplaceRule[]> {
    const result = await this.owner.request('replace-rule.list', {});
    return this.requireArray(result.data['rules'], 'replace-rule.list')
      .map((value: unknown): ManagedReplaceRule => this.decodeReplaceRule(value));
  }

  async saveReplaceRule(draft: ReplaceRuleDraft): Promise<void> {
    const validation = await this.owner.request('replace.validate', {
      pattern: draft.pattern,
      isRegex: draft.isRegex,
      scope: ['chapter'],
    });
    if (validation.data['valid'] !== true) {
      throw new Error('Core 拒绝保存：替换规则未通过语义校验');
    }
    const params: JsonObject = {
      name: draft.name.trim(),
      pattern: draft.pattern,
      replacement: draft.replacement,
      scopeTitle: false,
      scopeContent: true,
      isEnabled: draft.isEnabled,
      isRegex: draft.isRegex,
      timeoutMillisecond: 3000,
      order: draft.order,
    };
    if (draft.id !== undefined) {
      params['id'] = draft.id;
    }
    await this.owner.request('replace.persist', {
      operation: draft.id === undefined ? 'create' : 'update',
      params,
    });
  }

  async deleteReplaceRule(id: number): Promise<void> {
    this.assertSafeInteger(id, 'replace rule id');
    await this.owner.request('replace.persist', { operation: 'delete', params: { id } });
  }

  async listTxtTocRules(): Promise<ManagedTxtTocRule[]> {
    const result = await this.owner.request('txt-toc-rule.list', {});
    return this.requireArray(result.data['rules'], 'txt-toc-rule.list')
      .map((value: unknown): ManagedTxtTocRule => this.decodeTxtTocRule(value));
  }

  async saveTxtTocRule(draft: TxtTocRuleDraft): Promise<void> {
    const params: JsonObject = {
      name: draft.name.trim(),
      rule: draft.rule,
      example: draft.example,
      serialNumber: draft.serialNumber,
      enable: draft.enable,
    };
    if (draft.id === undefined) {
      await this.owner.request('txt-toc-rule.create', params);
    } else {
      params['id'] = draft.id;
      await this.owner.request('txt-toc-rule.update', params);
    }
  }

  async deleteTxtTocRule(id: number): Promise<void> {
    this.assertSafeInteger(id, 'TXT TOC rule id');
    await this.owner.request('txt-toc-rule.delete', { id });
  }

  async listDictRules(): Promise<ManagedDictRule[]> {
    const result = await this.owner.request('dict-rule.list', {});
    return this.requireArray(result.data['rules'], 'dict-rule.list')
      .map((value: unknown): ManagedDictRule => this.decodeDictRule(value));
  }

  async saveDictRule(draft: DictRuleDraft): Promise<void> {
    await this.owner.request('dict-rule.put', {
      name: draft.name.trim(),
      urlRule: draft.urlRule,
      showRule: draft.showRule,
      enabled: draft.enabled,
      sortNumber: draft.sortNumber,
    });
  }

  async deleteDictRule(name: string): Promise<void> {
    await this.owner.request('dict-rule.delete', { name });
  }

  async listRuleSubscriptions(): Promise<ManagedRuleSubscription[]> {
    const result = await this.owner.request('rule-sub.list', {});
    return this.requireArray(result.data['subs'], 'rule-sub.list')
      .map((value: unknown): ManagedRuleSubscription => this.decodeRuleSubscription(value));
  }

  async saveRuleSubscription(draft: RuleSubscriptionDraft): Promise<void> {
    await this.owner.request('rule-sub.put', {
      id: draft.id ?? Date.now(),
      name: draft.name.trim(),
      url: draft.url.trim(),
      type: 0,
      customOrder: draft.customOrder,
      autoUpdate: draft.autoUpdate,
      update: 0,
    });
  }

  async deleteRuleSubscription(id: number): Promise<void> {
    this.assertSafeInteger(id, 'rule subscription id');
    await this.owner.request('rule-sub.delete', { id });
  }

  async exportBundle(): Promise<RuleBundleExport> {
    const result = await this.owner.request('rule-bundle.export', {});
    const json = result.data['json'];
    const counts = this.requireObject(result.data['counts'], 'rule-bundle.export counts');
    if (typeof json !== 'string' || result.data['schemaVersion'] !== 1) {
      throw new Error('rule-bundle.export returned invalid data');
    }
    return {
      json,
      summary: `${this.requireCount(counts, 'replaceRules')} 替换 / ` +
        `${this.requireCount(counts, 'dictRules')} 字典 / ` +
        `${this.requireCount(counts, 'txtTocRules')} TXT / ` +
        `${this.requireCount(counts, 'ruleSubscriptions')} 订阅`,
    };
  }

  async importBundle(json: string, replaceExisting: boolean): Promise<string> {
    const result = await this.owner.request('rule-bundle.import', { json, replaceExisting });
    const counts = this.requireObject(result.data['counts'], 'rule-bundle.import counts');
    if (result.data['schemaVersion'] !== 1 || result.data['replaceExisting'] !== replaceExisting) {
      throw new Error('rule-bundle.import returned mismatched data');
    }
    return `已导入 ${this.requireCount(counts, 'replaceRules') + this.requireCount(counts, 'dictRules') +
      this.requireCount(counts, 'txtTocRules') + this.requireCount(counts, 'ruleSubscriptions')} 条 Core 规则实体`;
  }

  private decodeReplaceRule(value: unknown): ManagedReplaceRule {
    const row = this.requireObject(value, 'replace rule');
    return {
      id: this.requireInteger(row, 'id'),
      name: this.requireString(row, 'name'),
      pattern: this.requireString(row, 'pattern'),
      replacement: this.requireString(row, 'replacement'),
      isEnabled: this.requireBoolean(row, 'isEnabled'),
      isRegex: this.requireBoolean(row, 'isRegex'),
      order: this.requireInteger(row, 'order'),
    };
  }

  private decodeTxtTocRule(value: unknown): ManagedTxtTocRule {
    const row = this.requireObject(value, 'TXT TOC rule');
    const example = row['example'];
    if (example !== undefined && example !== null && typeof example !== 'string') {
      throw new Error('TXT TOC rule returned invalid example');
    }
    return {
      id: this.requireInteger(row, 'id'),
      name: this.requireString(row, 'name'),
      rule: this.requireString(row, 'rule'),
      example: typeof example === 'string' ? example : '',
      enable: this.requireBoolean(row, 'enable'),
      serialNumber: this.requireInteger(row, 'serialNumber'),
    };
  }

  private decodeDictRule(value: unknown): ManagedDictRule {
    const row = this.requireObject(value, 'dict rule');
    return {
      name: this.requireString(row, 'name'),
      urlRule: this.requireString(row, 'urlRule'),
      showRule: this.requireString(row, 'showRule'),
      enabled: this.requireBoolean(row, 'enabled'),
      sortNumber: this.requireInteger(row, 'sortNumber'),
    };
  }

  private decodeRuleSubscription(value: unknown): ManagedRuleSubscription {
    const row = this.requireObject(value, 'rule subscription');
    return {
      id: this.requireInteger(row, 'id'),
      name: this.requireString(row, 'name'),
      url: this.requireString(row, 'url'),
      autoUpdate: this.requireBoolean(row, 'autoUpdate'),
      customOrder: this.requireInteger(row, 'customOrder'),
    };
  }

  private requireArray(value: unknown, context: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${context} returned invalid data`);
    return value;
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context} is not an object`);
    }
    return value as JsonObject;
  }

  private requireString(row: JsonObject, key: string): string {
    const value = row[key];
    if (typeof value !== 'string') throw new Error(`invalid ${key}`);
    return value;
  }

  private requireBoolean(row: JsonObject, key: string): boolean {
    const value = row[key];
    if (typeof value !== 'boolean') throw new Error(`invalid ${key}`);
    return value;
  }

  private requireInteger(row: JsonObject, key: string): number {
    const value = row[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`invalid ${key}`);
    return value;
  }

  private requireCount(row: JsonObject, key: string): number {
    const value = this.requireInteger(row, key);
    if (value < 0) throw new Error(`invalid ${key}`);
    return value;
  }

  private assertSafeInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  }
}
