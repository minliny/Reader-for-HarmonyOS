import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { RulesMutationOwner, type RulesMutationSnapshot } from '../settings/RulesMutationOwner';

/** Per-book TXT hierarchy keeps Core's original parser/publication authority.
 * The existing rule owner retains its one full original intent and exact ACK;
 * current rules or a successful preview never acknowledge an earlier apply. */
export class ReaderDirectoryRulesGateway {
  constructor(private readonly runtime: ReaderRuntimeOwner) {}
  private owner(): RulesMutationOwner { return RulesMutationOwner.forRuntime(this.runtime); }
  snapshot(): RulesMutationSnapshot { return this.owner().snapshot(); }
  ownsRuntime(): boolean { try { return ReaderRuntimeOwner.isCurrent(this.runtime); } catch (_) { return false; } }
  supportsApply(): boolean { return this.runtime.supportsCoreCapability('rules.mutation.directory-rules.v1'); }
  private current(admission: () => boolean): boolean { return this.ownsRuntime() && admission(); }

  async read(bookId: string, admission: () => boolean): Promise<JsonObject> {
    const event = await this.runtime.request('reading.directory.rules.get.v2', { sourceId: 'local', bookId },
      { canDispatch: (): boolean => this.current(admission), shouldCancel: (): boolean => !this.current(admission) });
    return event.data;
  }
  async preview(bookId: string, rules: JsonObject[], admission: () => boolean): Promise<JsonObject> {
    const event = await this.runtime.request('reading.directory.rules.preview.v2', { sourceId: 'local', bookId, rules },
      { canDispatch: (): boolean => this.current(admission), shouldCancel: (): boolean => !this.current(admission) });
    return event.data;
  }
  async apply(bookId: string, rules: JsonObject[], admission: () => boolean): Promise<JsonObject> {
    if (!this.supportsApply()) throw new Error('当前 Core 不支持本书目录规则原操作回执，未派发');
    return this.owner().run('本书目录层级规则', admission, async (request, confirmed): Promise<JsonObject> => {
      const event = await request('reading.directory.rules.apply.v2', { sourceId: 'local', bookId, rules });
      this.qualify('reading.directory.rules.apply.v2', { sourceId: 'local', bookId, rules }, event.data);
      confirmed(); return event.data;
    });
  }
  async inspect(admission: () => boolean, operationId?: string): Promise<RulesMutationSnapshot> {
    return this.owner().recoverOriginal(admission, (method: string, params: JsonObject, data: JsonObject): void => {
      if (method === 'reading.directory.rules.apply.v2') this.qualify(method, params, data);
    }, false, 'directory-rules', undefined, operationId, undefined, true);
  }
  async continueOriginal(bookId: string, operationId: string, admission: () => boolean): Promise<RulesMutationSnapshot> {
    return this.owner().recoverOriginal(admission,
      (method: string, params: JsonObject, data: JsonObject): void => this.qualify(method, params, data),
      true, 'directory-rules', undefined, operationId,
      (method: string, params: JsonObject): boolean => method === 'reading.directory.rules.apply.v2' &&
        params['sourceId'] === 'local' && params['bookId'] === bookId);
  }
  private qualify(method: string, params: JsonObject, data: JsonObject): void {
    if (method !== 'reading.directory.rules.apply.v2' || data['status'] !== 'ready' ||
      data['sourceId'] !== 'local' || data['bookId'] !== params['bookId'] ||
      typeof data['navigationRevision'] !== 'string' || data['navigationRevision'] !== data['structureRevision'] ||
      !Number.isSafeInteger(data['nodeCount']) || (data['nodeCount'] as number) < 0 ||
      !Number.isSafeInteger(data['readableChapterCount']) || (data['readableChapterCount'] as number) < 0 ||
      !Array.isArray(data['nodes'])) throw new Error('本书目录规则原回执不匹配，保留原操作核对');
  }
}
