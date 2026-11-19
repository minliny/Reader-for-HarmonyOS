import { decodeReaderDirectoryPage, type ReaderDirectoryNavigationNode } from './ReaderDirectoryNavigation';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { RulesMutationOwner, type RulesMutationSnapshot } from '../../settings/application/RulesMutationOwner';

export interface ReaderDirectoryRulesPreviewProof {
  previewId: string; inputRevision: string; rulesRevision: string; navigationRevision: string;
}
export interface ReaderDirectoryRulesPreview {
  bookId: string; proof: ReaderDirectoryRulesPreviewProof; nodeCount: number;
  readableChapterCount: number; offset: number; nodes: ReaderDirectoryNavigationNode[]; nextOffset?: number;
}
interface PreviewContext { preview: ReaderDirectoryRulesPreview; rules: string; }

/** Per-book TXT hierarchy keeps Core's original parser/publication authority.
 * The existing rule owner retains its one full original intent and exact ACK;
 * current rules or a successful preview never acknowledge an earlier apply. */
export class ReaderDirectoryRulesGateway {
  constructor(private readonly runtime: ReaderRuntimeOwner) {}
  private previewGeneration: number = 0;
  private previewContext: PreviewContext | undefined = undefined;
  private readonly nodeRanks: Map<string, number> = new Map();
  supportsPreview(): boolean { return this.runtime.supportsCoreCapability('reading.directory.rules.preview-view.v1'); }
  currentPreview(): ReaderDirectoryRulesPreview | undefined { return this.previewContext?.preview; }
  releasePreview(): void {
    this.previewGeneration += 1;
    const previous = this.previewContext?.preview;
    this.previewContext = undefined; this.nodeRanks.clear();
    if (previous !== undefined) this.closePreview(previous.bookId, previous.proof.previewId);
  }
  private closePreview(bookId: string, previewId: string): void {
    if (!this.ownsRuntime()) return;
    void this.runtime.request('reading.directory.rules.preview.close.v2', {sourceId:'local', bookId, previewId},
      {canDispatch: (): boolean => this.ownsRuntime(), timeoutMs: 5000}).catch((_error: Error): void => {});
  }
  private decodePreview(data: JsonObject, bookId: string, offset: number,
    expected?: ReaderDirectoryRulesPreview): ReaderDirectoryRulesPreview {
    const names: string[] = ['previewId','inputRevision','rulesRevision','navigationRevision'];
    for (const name of names) if (typeof data[name] !== 'string' || (data[name] as string).length === 0 ||
      (data[name] as string).length > 256) throw new Error('preview identity invalid');
    if (data['status'] !== 'ready' || data['sourceId'] !== 'local' || data['bookId'] !== bookId ||
      data['offset'] !== offset || data['structureRevision'] !== data['navigationRevision'] ||
      !Number.isSafeInteger(data['nodeCount']) || (data['nodeCount'] as number) < 0 || (data['nodeCount'] as number) > 50000 ||
      !Number.isSafeInteger(data['readableChapterCount']) || (data['readableChapterCount'] as number) < 0) throw new Error('preview range invalid');
    const proof: ReaderDirectoryRulesPreviewProof = { previewId: data['previewId'] as string, inputRevision: data['inputRevision'] as string,
      rulesRevision: data['rulesRevision'] as string, navigationRevision: data['navigationRevision'] as string };
    if (expected !== undefined && (JSON.stringify(proof) !== JSON.stringify(expected.proof) || data['nodeCount'] !== expected.nodeCount ||
      data['readableChapterCount'] !== expected.readableChapterCount)) throw new Error('preview version changed');
    const decoded = decodeReaderDirectoryPage({viewId:proof.previewId,visibleTotal:data['nodeCount'],nodes:data['nodes'],nextOffset:data['nextOffset']},proof.previewId,offset);
    if (decoded.nodes.length !== Math.min(256, decoded.visibleTotal-offset) ||
      decoded.nextOffset !== (offset+decoded.nodes.length < decoded.visibleTotal ? offset+decoded.nodes.length : undefined)) throw new Error('preview page incomplete');
    for (let index=0; index<decoded.nodes.length; index+=1) {
      const node=decoded.nodes[index], rank=offset+index, previous=this.nodeRanks.get(node.nodeId);
      if (previous !== undefined && previous !== rank) throw new Error('preview node order changed');
      this.nodeRanks.set(node.nodeId,rank);
    }
    return {bookId,proof,nodeCount:decoded.visibleTotal,readableChapterCount:data['readableChapterCount'] as number,
      offset,nodes:decoded.nodes,nextOffset:decoded.nextOffset};
  }
  async previewPage(offset: number, admission: () => boolean): Promise<ReaderDirectoryRulesPreview> {
    const context=this.previewContext, generation=this.previewGeneration;
    if (context===undefined || !Number.isSafeInteger(offset) || offset<0 || offset>=context.preview.nodeCount || offset%256!==0)
      throw new Error('preview range not current');
    const current=(): boolean => generation===this.previewGeneration && context===this.previewContext && this.current(admission);
    const event=await this.runtime.request('reading.directory.rules.preview.page.v2',
      {sourceId:'local',bookId:context.preview.bookId,expectedPreview:this.proofParams(context.preview.proof),offset,limit:256},
      {canDispatch:current,shouldCancel:(): boolean=>!current()});
    if (!current()) throw new Error('preview owner retired');
    return this.decodePreview(event.data,context.preview.bookId,offset,context.preview);
  }
  private proofParams(proof: ReaderDirectoryRulesPreviewProof): JsonObject {
    return {previewId:proof.previewId,inputRevision:proof.inputRevision,rulesRevision:proof.rulesRevision,navigationRevision:proof.navigationRevision};
  }
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
    this.releasePreview();
    if (!this.supportsPreview()) throw new Error('当前 Core 尚不支持完整目录预览');
    const generation=this.previewGeneration;
    const current=(): boolean=>generation===this.previewGeneration && this.current(admission);
    const event=await this.runtime.request('reading.directory.rules.preview.v2',{sourceId:'local',bookId,rules,previewView:true},
      {canDispatch:current,shouldCancel:(): boolean=>!current()});
    if (!current()) {
      if (typeof event.data['previewId']==='string') this.closePreview(bookId,event.data['previewId'] as string);
      throw new Error('preview owner retired');
    }
    if(event.data['status']!=='ready') return event.data;
    try { this.previewContext={preview:this.decodePreview(event.data,bookId,0),rules:JSON.stringify(rules)}; }
    catch(error) { if(typeof event.data['previewId']==='string') this.closePreview(bookId,event.data['previewId'] as string); throw error; }
    return event.data;
  }
  async apply(bookId: string, rules: JsonObject[], admission: () => boolean): Promise<JsonObject> {
    if (!this.supportsApply()) throw new Error('当前 Core 不支持本书目录规则原操作回执，未派发');
    const context=this.previewContext;
    if(context===undefined || context.preview.bookId!==bookId || context.rules!==JSON.stringify(rules)) throw new Error('请重新预览当前规则后应用');
    const params: JsonObject={sourceId:'local',bookId,rules,expectedPreview:this.proofParams(context.preview.proof)};
    return this.owner().run('本书目录层级规则', admission, async (request, confirmed): Promise<JsonObject> => {
      const event = await request('reading.directory.rules.apply.v2', params);
      this.qualify('reading.directory.rules.apply.v2', params, event.data);
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
      !Array.isArray(data['nodes']) ||
      (params['expectedPreview'] !== undefined && (params['expectedPreview'] as JsonObject)['navigationRevision'] !== data['navigationRevision'])) throw new Error('本书目录规则原回执不匹配，保留原操作核对');
  }
}
