import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { BookRequestNotDispatchedError, type BookRequestOptions } from '../../app/BookRequestScheduler';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';

export interface RulesMutationSnapshot {
  generation: number;
  busy: boolean;
  confirmation: 'undispatched' | 'confirmed' | 'unknown';
  label: string;
  method: string;
  message: string;
}

export class RulesMutationError extends Error {
  readonly writeUncertain: boolean;
  constructor(message: string, writeUncertain: boolean) {
    super(message); this.name = 'RulesMutationError'; this.writeUncertain = writeUncertain;
  }
}

/** One existing Core rule collection authority, shared by settings and the
 * two reader presentations. It neither owns rule data nor replays commands.
 * A list read cannot settle this original command. Legacy Core has no exact
 * rule mutation query; cold durable reconciliation remains a separate exit. */
export class RulesMutationOwner {
  private static readonly owners: WeakMap<ReadingGatewayRuntime, RulesMutationOwner> = new WeakMap();
  static forRuntime(runtime: ReadingGatewayRuntime): RulesMutationOwner {
    let owner = RulesMutationOwner.owners.get(runtime);
    if (owner === undefined) { owner = new RulesMutationOwner(runtime); RulesMutationOwner.owners.set(runtime, owner); }
    return owner;
  }

  private state: RulesMutationSnapshot = { generation: 0, busy: false, confirmation: 'undispatched',
    label: '', method: '', message: '' };
  private originalParams: string = '';
  private readonly runtime: ReadingGatewayRuntime;
  private constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }
  snapshot(): RulesMutationSnapshot { return { ...this.state }; }

  async run<T>(label: string, isCurrent: () => boolean,
    operation: (request: (method: string, params: JsonObject) => Promise<ReaderCoreResultEvent>,
      confirmed: () => void) => Promise<T>, observer?: ReaderWriteEvidence): Promise<T> {
    if (this.state.busy || this.state.confirmation === 'unknown')
      throw new RulesMutationError(this.state.confirmation === 'unknown' ?
        '先前规则写入结果未确认；读取当前列表不会解除原操作保护' : '另一规则操作正在执行',
      this.state.confirmation === 'unknown');
    const current = (): boolean => { try { return isCurrent(); } catch (_) { return false; } };
    if (!current()) throw new RulesMutationError('规则请求已过期，未派发', false);
    const evidence = new ReaderWriteEvidence();
    const generation = this.state.generation + 1;
    this.state = { generation, busy: true, confirmation: 'undispatched', label, method: '', message: '' };
    const request = async (method: string, params: JsonObject): Promise<ReaderCoreResultEvent> => {
      if (evidence.dispatchedCount !== 0) throw new Error('one rule operation must contain one mutation command');
      this.state.method = method; this.originalParams = JSON.stringify(params);
      const options: BookRequestOptions = {
        canDispatch: (): boolean => this.state.generation === generation && this.state.busy && current(),
        onDispatch: (): void => { evidence.dispatched(); observer?.dispatched(); },
      };
      try { return await this.runtime.request(method, params, options); }
      catch (error) {
        if (error instanceof BookRequestNotDispatchedError) {
          evidence.rejectedBeforeExecution(); observer?.rejectedBeforeExecution();
        }
        throw error;
      }
    };
    const confirmed = (): void => {
      if (evidence.dispatchedCount !== 1 || evidence.confirmedCount !== 0)
        throw new Error('qualified rule ACK requires the original actual dispatch');
      evidence.confirmed(); observer?.confirmed();
      this.state.confirmation = 'confirmed';
    };
    try {
      const value = await operation(request, confirmed);
      if (evidence.confirmation() !== 'confirmed') throw new Error('rule operation did not return a qualified original ACK');
      this.state.confirmation = 'confirmed'; this.state.message = ''; this.originalParams = '';
      return value;
    } catch (error) {
      this.state.confirmation = evidence.confirmation();
      const message = error instanceof Error ? error.message : '规则操作异常';
      this.state.message = message;
      if (this.state.confirmation !== 'unknown') this.originalParams = '';
      throw new RulesMutationError(this.state.confirmation === 'unknown' ?
        `写入结果未确认；可读取当前列表，但不能重放或继续写入：${message}` : message,
      this.state.confirmation === 'unknown');
    } finally { this.state.busy = false; }
  }
}
