import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts, type CommitConfirmationKind } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from './RssMutationRecoveryContract';
import {
  RssGateway,
  type RssSourceDraft,
  type RssSubscription,
} from './RssGateway';

const DOMAIN = 0x5244;
function logEditorError(error: Error): void {
  try { hilog.error(DOMAIN, 'Reader', '%{private}s', error.message); } catch (_error) {}
}
let editorProjectionGeneration: number = 0;
interface RssEditorReceipt { confirmation: CommitConfirmationKind; subscriptionId: string; revision: number; projection: PersistedReceiptProjection<RssSubscription>; }

export interface RssSubscriptionEditorSnapshot {
  mode: 'create' | 'edit';
  subscriptionId: string;
  feedUrl: string;
  title: string;
  enabled: boolean;
  sourceGroup: string;
  customOrder: string;
  updateIntervalMinutes: string;
  header: string;
  enabledCookieJar: boolean;
  ruleArticles: string;
  ruleNextPage: string;
  ruleTitle: string;
  rulePubDate: string;
  ruleDescription: string;
  ruleImage: string;
  ruleLink: string;
  ruleContent: string;
  busy: boolean;
  statusMessage: string;
  canSave: boolean;
  readFacts: OperationFacts<RssSubscription>;
  operation: PersistedReceiptProjection<RssSubscription> | undefined;
  original?: RssOriginalMutationProjection;
}

export const EMPTY_RSS_EDITOR_SNAPSHOT: RssSubscriptionEditorSnapshot = {
  mode: 'create',
  subscriptionId: '',
  feedUrl: '',
  title: '',
  enabled: true,
  sourceGroup: '',
  customOrder: '',
  updateIntervalMinutes: '',
  header: '',
  enabledCookieJar: false,
  ruleArticles: '',
  ruleNextPage: '',
  ruleTitle: '',
  rulePubDate: '',
  ruleDescription: '',
  ruleImage: '',
  ruleLink: '',
  ruleContent: '',
  busy: false,
  statusMessage: '',
  canSave: true,
  readFacts: projectOperationFacts<RssSubscription>({ phase: 'idle' }),
  operation: undefined,
};

/** Thin UI coordinator over canonical Core rss.subscription.create/update. */
export class RssSubscriptionEditorOrchestrator {
  private static readonly retained: WeakMap<ReaderRuntimeOwner, RssSubscriptionEditorOrchestrator> = new WeakMap();

  /** Warm owner retention does not manufacture a cold Core receipt. */
  static forRuntime(owner: ReaderRuntimeOwner,
    serialize: (work: () => Promise<void>) => Promise<void>): RssSubscriptionEditorOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    const retained = RssSubscriptionEditorOrchestrator.retained.get(owner);
    if (retained !== undefined) return retained;
    const editor = new RssSubscriptionEditorOrchestrator((_snapshot: RssSubscriptionEditorSnapshot): void => {},
      (_id: string): void => {}, (): boolean => false, owner, serialize);
    RssSubscriptionEditorOrchestrator.retained.set(owner, editor);
    return editor;
  }
  private readonly gateway: RssGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly serialize: (work: () => Promise<void>) => Promise<void>;
  private serialTail: Promise<void> = Promise.resolve();
  private activeKey: string = 'create';
  private readonly drafts: Map<string, RssSubscriptionEditorSnapshot> = new Map();
  private readonly revisions: Map<string, number> = new Map();
  private readonly dirty: Map<string, boolean> = new Map();
  private readonly receipts: Map<string, RssEditorReceipt> = new Map();
  private readonly pending: Set<string> = new Set();
  private emit: (snapshot: RssSubscriptionEditorSnapshot) => void;
  private onSaved: (subscriptionId: string) => void;
  private isCurrent: () => boolean;
  private presentationIdentity: string | undefined = undefined;
  private snapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  private session: number = 0;


  constructor(
    emit: (snapshot: RssSubscriptionEditorSnapshot) => void,
    onSaved: (subscriptionId: string) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    serialize?: (work: () => Promise<void>) => Promise<void>,
  ) {
    this.owner = owner;
    this.gateway = new RssGateway(owner);
    this.serialize = serialize ?? ((work: () => Promise<void>): Promise<void> => {
      const result = this.serialTail.then(work);
      this.serialTail = result.catch((): void => {});
      return result;
    });
    this.emit = emit;
    this.onSaved = onSaved;
    this.isCurrent = isCurrent;
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }
  ownsPresentation(identity: string): boolean {
    return this.ownsRuntime() && identity.length > 0 && this.presentationIdentity === identity;
  }

  attachPresentation(identity: string, emit: (snapshot: RssSubscriptionEditorSnapshot) => void,
    onSaved: (subscriptionId: string) => void, isCurrent: () => boolean, admitted: () => boolean): boolean {
    if (!this.ownsRuntime() || identity.length === 0) return false;
    try { if (!admitted()) return false; } catch (_error) { return false; }
    if (this.presentationIdentity !== identity) this.session += 1;
    this.presentationIdentity = identity;
    this.emit = emit;
    this.onSaved = onSaved;
    this.isCurrent = isCurrent;
    if (this.isCurrentSession(this.session)) {
      try { this.emit(this.copySnapshot(this.snapshot)); } catch (error) { logEditorError(error as Error); }
    }
    return true;
  }

  detachPresentation(identity: string): void {
    if (this.presentationIdentity !== identity) return;
    this.presentationIdentity = undefined;
    this.session += 1;
    this.emit = (_snapshot: RssSubscriptionEditorSnapshot): void => {};
    this.onSaved = (_id: string): void => {};
    this.isCurrent = (): boolean => false;
  }

  openCreate(): void { this.open('create', ''); }

  openEdit(subscriptionId: string): void { this.open('edit', subscriptionId); }

  private open(mode: 'create' | 'edit', subscriptionId: string): void {
    if (!this.isCurrentSession(this.session)) return;
    this.session += 1;
    const session = this.session;
    this.activeKey = mode === 'create' ? 'create' : JSON.stringify(['edit', subscriptionId]);
    const saved = this.drafts.get(this.activeKey);
    this.snapshot = this.copySnapshot(saved ?? EMPTY_RSS_EDITOR_SNAPSHOT);
    if (saved === undefined) { this.snapshot.mode = mode; this.snapshot.subscriptionId = subscriptionId; }
    const receipt = this.receipts.get(this.activeKey);
    this.publish({ busy: this.pending.has(this.activeKey), canSave: !this.pending.has(this.activeKey) && receipt?.confirmation !== 'unknown' && receipt?.projection.receipt.readback !== 'reading' &&
      receipt?.projection.receipt.fact !== 'confirmedRefreshFailed',
      operation: receipt?.projection, statusMessage: receipt?.projection.facts.message ?? (mode === 'create' ? '新增 RSS 订阅' : '正在读取 Core 订阅…') });
    if (mode === 'edit' || receipt !== undefined || this.pending.has(this.activeKey) || this.gateway.supportsOriginalRecovery()) {
      const key = this.activeKey;
      void this.serialize(async (): Promise<void> => { if (this.isCurrentSession(session)) await this.readEditor(key, session); }).catch((error: Error): void => this.fail(session, 'RSS 读取未执行', error));
    }
  }

  updateFeedUrl(value: string): void {
    if (value.length <= 8192) {
      this.publishDraft({ feedUrl: value });
    }
  }

  updateTitle(value: string): void {
    if (value.length <= 512) {
      this.publishDraft({ title: value });
    }
  }

  updateEnabled(value: boolean): void {
    this.publishDraft({ enabled: value });
  }

  updateEnabledCookieJar(value: boolean): void {
    this.publishDraft({ enabledCookieJar: value });
  }

  updateSourceField(field: RssSourceTextField, value: string): void {
    if (value.length > 8192) {
      return;
    }
    if (field === 'sourceGroup') this.publishDraft({ sourceGroup: value });
    else if (field === 'customOrder') this.publishDraft({ customOrder: value });
    else if (field === 'updateIntervalMinutes') this.publishDraft({ updateIntervalMinutes: value });
    else if (field === 'header') this.publishDraft({ header: value });
    else if (field === 'ruleArticles') this.publishDraft({ ruleArticles: value });
    else if (field === 'ruleNextPage') this.publishDraft({ ruleNextPage: value });
    else if (field === 'ruleTitle') this.publishDraft({ ruleTitle: value });
    else if (field === 'rulePubDate') this.publishDraft({ rulePubDate: value });
    else if (field === 'ruleDescription') this.publishDraft({ ruleDescription: value });
    else if (field === 'ruleImage') this.publishDraft({ ruleImage: value });
    else if (field === 'ruleLink') this.publishDraft({ ruleLink: value });
    else if (field === 'ruleContent') this.publishDraft({ ruleContent: value });
  }

  save(): void {
    const session = this.session, key = this.activeKey;
    if (!this.isCurrentSession(session) || !this.snapshot.canSave || this.pending.has(key) || this.receipts.get(key)?.confirmation === 'unknown' ||
      this.gateway.originalMutationSnapshot()?.blocked===true || this.gateway.originalMutationSnapshot()?.busy===true) return;
    const current = this.copySnapshot(this.snapshot);
    let draft: RssSourceDraft;
    try { draft = this.sourceDraft(current); }
    catch (error) { this.publish({ busy: false, statusMessage: `RSS 订阅尚未提交：${(error as Error).message}` }); return; }
    const revision = this.revisions.get(key) ?? 0;
    this.pending.add(key);
    this.publish({ busy: true, canSave: false, statusMessage: '正在由 Core 保存 RSS 订阅…' });
    void this.serialize(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) {
        this.pending.delete(key);
        this.patchDraft(key, { busy: false, canSave: true, statusMessage: 'RSS 订阅尚未提交，草稿已保留' });
        return;
      }
      const evidence = new ReaderWriteEvidence();
      this.gateway.observeWrites(evidence, (): boolean => this.isCurrentSession(session));
      let subscriptionId = current.subscriptionId;
      try {
        if (current.mode === 'create') subscriptionId = (await this.gateway.createSubscription(draft)).subscription.subscriptionId;
        else subscriptionId = (await this.gateway.updateSubscription(current.subscriptionId, draft)).subscriptionId;
      } catch (error) {
        this.pending.delete(key);
        const confirmation = evidence.confirmation();
        this.setReceipt(key, session, confirmation, subscriptionId, revision, 'failed', undefined, (error as Error).message);
        this.patchDraft(key, { busy: false, canSave: confirmation === 'undispatched' && this.gateway.originalMutationSnapshot()?.blocked!==true,
          original:this.gateway.originalMutationSnapshot() });
        if (this.isCurrentSession(session)) this.publish({ busy: false, canSave: confirmation === 'undispatched' && this.gateway.originalMutationSnapshot()?.blocked!==true,
          original:this.gateway.originalMutationSnapshot(),
          statusMessage: this.receipts.get(key)?.projection.facts.message ?? '提交结果待核对' });
        return;
      } finally { this.gateway.observeWrites(undefined); }
      this.pending.delete(key);
      this.setReceipt(key, session, evidence.confirmation(), subscriptionId, revision, 'reading');
      this.patchDraft(key, { busy: false, canSave: false });
      if (!this.ownsRuntime()) return;
      await this.readEditor(key, session, true);
    }).catch((error: Error): void => {
      this.pending.delete(key);
      this.patchDraft(key, { busy: false, canSave: this.receipts.get(key)?.confirmation !== 'unknown' });
      this.fail(session, 'RSS 操作未执行', error);
    });
  }

  reconcile(generation: number): void {
    const session = this.session, key = this.activeKey, receipt = this.receipts.get(key);
    if (receipt === undefined || receipt.projection.facts.generation !== generation || !receipt.projection.facts.canRetry) return;
    void this.serialize(async (): Promise<void> => {
      const latest = this.receipts.get(key);
      if (!this.isCurrentSession(session) || latest?.projection.facts.generation !== generation || !latest.projection.facts.canRetry) return;
      await this.readEditor(key, session, true);
    }).catch((error: Error): void => this.fail(session, 'RSS 核对未执行', error));
  }

  continueOriginal(expected: RssOriginalMutationIdentity, identity?: string): void {
    const session=this.session,key=this.activeKey;
    if (expected.scope!=='editor') return;
    void this.serialize(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || identity!==undefined && identity!==this.presentationIdentity ||
        expected.subscriptionId!==(this.drafts.get(key)?.mode==='edit' ? this.drafts.get(key)?.subscriptionId : '')) return;
      const result=await this.gateway.recoverOriginalRss((): boolean => this.isCurrentSession(session),expected,true);
      if (result.outcome?.subscription!==undefined) this.setReceipt(key,session,'confirmed',result.outcome.subscription.subscriptionId,
        this.receipts.get(key)?.revision ?? this.revisions.get(key) ?? 0,'reading');
      await this.readEditor(key,session,true);
    }).catch((error: Error): void => this.fail(session,'RSS 原操作未继续',error));
  }

  retryLoad(generation: number): void {
    const session = this.session, key = this.activeKey;
    void this.serialize(async (): Promise<void> => {
      if (!this.isCurrentSession(session) || this.snapshot.readFacts.generation !== generation || !this.snapshot.readFacts.canRetry) return;
      await this.readEditor(key, session);
    }).catch((error: Error): void => this.fail(session, 'RSS 读取未执行', error));
  }

  private async readEditor(key: string, session: number, finishSaved: boolean = false): Promise<void> {
    if (!this.ownsRuntime()) return;
    let draft = this.drafts.get(key);
    if (draft === undefined) return;
    const recovery=await this.gateway.recoverOriginalRss((): boolean => this.isCurrentSession(session));
    const original=recovery.original;
    const matchesEditor=original?.scope==='editor' && original.subscriptionId===(draft.mode==='edit' ? draft.subscriptionId : '');
    if (matchesEditor && original!==undefined) {
      if (original.blocked && !this.dirty.get(key)) {
        const accepted=this.gateway.originalSourceDraft();
        if (accepted!==undefined) {
          const fields=this.fieldsFromAcceptedDraft(accepted.draft);this.patchDraft(key,fields);
          if (this.isCurrentSession(session) && this.activeKey===key) this.publish(fields);
        }
        draft=this.drafts.get(key) ?? draft;
      }
      if (recovery.outcome?.subscription!==undefined || original.blocked && this.receipts.get(key)===undefined ||
        !original.blocked && original.confirmation==='undispatched' && this.receipts.get(key)?.confirmation==='unknown')
        this.setReceipt(key,session,original.confirmation,recovery.outcome?.subscription?.subscriptionId ?? draft.subscriptionId,
          this.receipts.get(key)?.revision ?? this.revisions.get(key) ?? 0,'reading');
    }
    const receipt = this.receipts.get(key);
    const publishCurrent = (patch: RssSubscriptionEditorPatch): void => {
      this.patchDraft(key, patch);
      if (this.isCurrentSession(session) && this.activeKey === key) this.publish(patch);
    };
    publishCurrent({original,canSave:original?.blocked!==true && original?.busy!==true && receipt?.confirmation!=='unknown'});
    publishCurrent({ busy: true, canSave: false, readFacts: projectOperationFacts<RssSubscription>({ phase: 'loading',
      value: receipt?.projection.value, generation: ++editorProjectionGeneration }) });
    if (receipt !== undefined) this.setReceipt(key, session, receipt.confirmation, receipt.subscriptionId, receipt.revision, 'reading', receipt.projection.value);
    try {
      const subscriptions = await this.gateway.loadSubscriptions();
      if (!this.ownsRuntime()) return;
      const subscriptionId = receipt?.subscriptionId || draft.subscriptionId;
      const subscription = subscriptionId.length > 0 ? subscriptions.find((candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId) :
        subscriptions.find((candidate: RssSubscription): boolean => candidate.feedUrl === draft.feedUrl.trim());
      if (subscription === undefined && (draft.mode === 'edit' || receipt?.confirmation === 'confirmed')) throw new Error('RSS 订阅已不存在');
      if (receipt !== undefined) this.setReceipt(key, session, receipt.confirmation, receipt.subscriptionId, receipt.revision, 'succeeded', subscription);
      const unchangedDraft = receipt !== undefined && (this.revisions.get(key) ?? 0) === receipt.revision;
      if ((receipt === undefined || recovery.outcome!==undefined && receipt.confirmation==='confirmed') &&
        subscription !== undefined && !this.dirty.get(key)) {
        publishCurrent(this.fieldsFromSubscription(subscription));
      }
      // A confirmed create owns its returned Core identity. If a newer draft
      // or a later editor entry remains open, subsequent explicit saves update
      // that identity rather than blindly creating a second subscription.
      if (receipt?.confirmation === 'confirmed' && subscription !== undefined) publishCurrent({ mode: 'edit', subscriptionId: subscription.subscriptionId });
      publishCurrent({ busy: false, canSave: receipt?.confirmation !== 'unknown' && original?.blocked!==true && original?.busy!==true,
        readFacts: projectOperationFacts<RssSubscription>({ phase: 'succeeded', value: subscription, generation: ++editorProjectionGeneration }),
        statusMessage: receipt?.confirmation === 'unknown' ? '提交结果待核对；已读取当前数据，原提交回执仍未确认，草稿保留' :
          receipt?.confirmation === 'confirmed' ? unchangedDraft ? 'RSS 订阅已保存' : '本次提交已保存，当前草稿仍有未保存更改' : '编辑 RSS 订阅' });
      if (finishSaved && receipt?.confirmation === 'confirmed' && unchangedDraft && this.isCurrentSession(session)) {
        this.drafts.delete(key); this.dirty.delete(key); this.revisions.delete(key); this.receipts.delete(key);
        try { this.onSaved(receipt.subscriptionId); } catch (error) { logEditorError(error as Error); }
      }
    } catch (error) {
      if (receipt !== undefined) this.setReceipt(key, session, receipt.confirmation, receipt.subscriptionId, receipt.revision, 'failed', receipt.projection.value, (error as Error).message);
      publishCurrent({ busy: false, canSave: (receipt?.confirmation === 'undispatched' || receipt === undefined) && original?.blocked!==true && original?.busy!==true,
        readFacts: projectOperationFacts<RssSubscription>({ phase: 'failed', value: receipt?.projection.value, canRetry: true,
          generation: ++editorProjectionGeneration, message: (error as Error).message }),
        statusMessage: receipt === undefined ? `RSS 订阅读取失败：${(error as Error).message}` :
          this.receipts.get(key)?.projection.facts.message ?? '提交结果待核对' });
    }
  }

  private setReceipt(key: string, session: number, confirmation: CommitConfirmationKind, subscriptionId: string, revision: number,
    readback: 'reading' | 'failed' | 'succeeded', value?: RssSubscription, refreshError?: string): void {
    const projection = projectPersistedReceipt<RssSubscription>({ confirmation, readback, value, refreshError,
      stale: readback === 'failed', canRetry: confirmation !== 'undispatched' && readback !== 'reading' &&
        (readback === 'failed' || confirmation === 'unknown'), generation: ++editorProjectionGeneration });
    this.receipts.set(key, { confirmation, subscriptionId, revision, projection });
    this.patchDraft(key, { operation: projection,original:this.gateway.originalMutationSnapshot() });
    if (this.isCurrentSession(session) && this.activeKey === key) this.publish({ operation: projection,original:this.gateway.originalMutationSnapshot() });
  }

  private fieldsFromSubscription(subscription: RssSubscription): RssSubscriptionEditorPatch {
    return { feedUrl: subscription.feedUrl, title: subscription.title, enabled: subscription.enabled,
      sourceGroup: subscription.sourceGroup ?? '', customOrder: subscription.customOrder?.toString() ?? '',
      updateIntervalMinutes: subscription.updateIntervalMinutes?.toString() ?? '', header: subscription.header ?? '',
      enabledCookieJar: subscription.enabledCookieJar ?? false, ruleArticles: subscription.ruleArticles ?? '',
      ruleNextPage: subscription.ruleNextPage ?? '', ruleTitle: subscription.ruleTitle ?? '', rulePubDate: subscription.rulePubDate ?? '',
      ruleDescription: subscription.ruleDescription ?? '', ruleImage: subscription.ruleImage ?? '', ruleLink: subscription.ruleLink ?? '', ruleContent: subscription.ruleContent ?? '' };
  }
  private fieldsFromAcceptedDraft(draft: RssSourceDraft): RssSubscriptionEditorPatch {
    return {feedUrl:draft.feedUrl,title:draft.title,enabled:draft.enabled,sourceGroup:draft.sourceGroup,
      customOrder:draft.customOrder?.toString() ?? '',updateIntervalMinutes:draft.updateIntervalMinutes?.toString() ?? '',
      header:draft.header,enabledCookieJar:draft.enabledCookieJar,ruleArticles:draft.ruleArticles,ruleNextPage:draft.ruleNextPage,
      ruleTitle:draft.ruleTitle,rulePubDate:draft.rulePubDate,ruleDescription:draft.ruleDescription,ruleImage:draft.ruleImage,
      ruleLink:draft.ruleLink,ruleContent:draft.ruleContent};
  }

  private patchDraft(key: string, patch: RssSubscriptionEditorPatch): void {
    const current = this.drafts.get(key);
    if (current !== undefined) this.drafts.set(key, this.patchedSnapshot(current, patch));
  }

  private publishDraft(patch: RssSubscriptionEditorPatch): void {
    if (!this.isCurrentSession(this.session)) return;
    const key = this.activeKey;
    this.dirty.set(key, true); this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    this.publish(patch);
  }

  private patchedSnapshot(current: RssSubscriptionEditorSnapshot, patch: RssSubscriptionEditorPatch): RssSubscriptionEditorSnapshot {
    return {
      mode: patch.mode ?? current.mode,
      subscriptionId: patch.subscriptionId ?? current.subscriptionId,
      feedUrl: patch.feedUrl ?? current.feedUrl,
      title: patch.title ?? current.title,
      enabled: patch.enabled ?? current.enabled,
      sourceGroup: patch.sourceGroup ?? current.sourceGroup,
      customOrder: patch.customOrder ?? current.customOrder,
      updateIntervalMinutes: patch.updateIntervalMinutes ?? current.updateIntervalMinutes,
      header: patch.header ?? current.header,
      enabledCookieJar: patch.enabledCookieJar ?? current.enabledCookieJar,
      ruleArticles: patch.ruleArticles ?? current.ruleArticles,
      ruleNextPage: patch.ruleNextPage ?? current.ruleNextPage,
      ruleTitle: patch.ruleTitle ?? current.ruleTitle,
      rulePubDate: patch.rulePubDate ?? current.rulePubDate,
      ruleDescription: patch.ruleDescription ?? current.ruleDescription,
      ruleImage: patch.ruleImage ?? current.ruleImage,
      ruleLink: patch.ruleLink ?? current.ruleLink,
      ruleContent: patch.ruleContent ?? current.ruleContent,
      busy: patch.busy ?? current.busy,
      statusMessage: patch.statusMessage ?? current.statusMessage,
      canSave: patch.canSave ?? current.canSave,
      readFacts: patch.readFacts ?? current.readFacts,
      operation: patch.operation ?? current.operation,
      original: patch.original ?? current.original,
    };
  }

  private publish(patch: RssSubscriptionEditorPatch): void {
    this.snapshot = this.patchedSnapshot(this.snapshot, patch);
    this.drafts.set(this.activeKey, this.copySnapshot(this.snapshot));
    if (this.isCurrentSession(this.session)) {
      try { this.emit(this.copySnapshot(this.snapshot)); }
      catch (error) { logEditorError(error as Error); }
    }
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) {
      this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    }
    logEditorError(error);
  }

  private copySnapshot(source: RssSubscriptionEditorSnapshot): RssSubscriptionEditorSnapshot {
    return {
      mode: source.mode,
      subscriptionId: source.subscriptionId,
      feedUrl: source.feedUrl,
      title: source.title,
      enabled: source.enabled,
      sourceGroup: source.sourceGroup,
      customOrder: source.customOrder,
      updateIntervalMinutes: source.updateIntervalMinutes,
      header: source.header,
      enabledCookieJar: source.enabledCookieJar,
      ruleArticles: source.ruleArticles,
      ruleNextPage: source.ruleNextPage,
      ruleTitle: source.ruleTitle,
      rulePubDate: source.rulePubDate,
      ruleDescription: source.ruleDescription,
      ruleImage: source.ruleImage,
      ruleLink: source.ruleLink,
      ruleContent: source.ruleContent,
      busy: source.busy,
      statusMessage: source.statusMessage,
      canSave: source.canSave,
      readFacts: source.readFacts,
      operation: source.operation,
      original: source.original,
    };
  }

  /** EntryAbility teardown unsets current(); retirement is an admission fact,
   * not a transport failure and must not erase an already accepted receipt. */
  private ownsRuntime(): boolean {
    try { return this.owner === ReaderRuntimeOwner.current(); }
    catch (_error) { return false; }
  }

  private isCurrentSession(session: number): boolean {
    try { return this.ownsRuntime() && this.isCurrent() && session === this.session; }
    catch (_error) { return false; }
  }

  private sourceDraft(snapshot: RssSubscriptionEditorSnapshot): RssSourceDraft {
    return {
      feedUrl: snapshot.feedUrl,
      title: snapshot.title,
      enabled: snapshot.enabled,
      sourceGroup: snapshot.sourceGroup,
      customOrder: this.optionalInteger(snapshot.customOrder, '自定义排序', false),
      updateIntervalMinutes: this.optionalInteger(snapshot.updateIntervalMinutes, '更新间隔', true),
      header: snapshot.header,
      enabledCookieJar: snapshot.enabledCookieJar,
      ruleArticles: snapshot.ruleArticles,
      ruleNextPage: snapshot.ruleNextPage,
      ruleTitle: snapshot.ruleTitle,
      rulePubDate: snapshot.rulePubDate,
      ruleDescription: snapshot.ruleDescription,
      ruleImage: snapshot.ruleImage,
      ruleLink: snapshot.ruleLink,
      ruleContent: snapshot.ruleContent,
    };
  }

  private optionalInteger(value: string, label: string, positive: boolean): number | undefined {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || (positive ? parsed <= 0 : parsed < 0)) {
      throw new Error(`${label}必须是${positive ? '正' : '非负'}整数`);
    }
    return parsed;
  }
}

export type RssSourceTextField =
  'sourceGroup' | 'customOrder' | 'updateIntervalMinutes' | 'header' |
  'ruleArticles' | 'ruleNextPage' | 'ruleTitle' | 'rulePubDate' |
  'ruleDescription' | 'ruleImage' | 'ruleLink' | 'ruleContent';

interface RssSubscriptionEditorPatch {
  mode?: 'create' | 'edit';
  subscriptionId?: string;
  feedUrl?: string;
  title?: string;
  enabled?: boolean;
  sourceGroup?: string;
  customOrder?: string;
  updateIntervalMinutes?: string;
  header?: string;
  enabledCookieJar?: boolean;
  ruleArticles?: string;
  ruleNextPage?: string;
  ruleTitle?: string;
  rulePubDate?: string;
  ruleDescription?: string;
  ruleImage?: string;
  ruleLink?: string;
  ruleContent?: string;
  busy?: boolean;
  statusMessage?: string;
  canSave?: boolean;
  readFacts?: OperationFacts<RssSubscription>;
  operation?: PersistedReceiptProjection<RssSubscription>;
  original?: RssOriginalMutationProjection;
}
