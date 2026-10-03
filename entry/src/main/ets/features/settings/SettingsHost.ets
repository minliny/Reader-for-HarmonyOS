import { SettingsOrchestrator, type SettingsKey, type SettingsOperationProjection } from './SettingsOrchestrator';
export type { SettingsOperationProjection } from './SettingsOrchestrator';
import type { SettingsSnapshot } from './SettingsGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { common } from '@kit.AbilityKit';

/**
 * Entry-owned Settings boundary. Index keeps the ArkUI snapshot projection
 * because other page shells consume it, while this host owns construction and
 * dispatch of the settings orchestrator and its context-bound gateway.
 */
export class SettingsHost {
  private orchestrator: SettingsOrchestrator | undefined = undefined;
  private readonly emit: (snapshot: SettingsSnapshot) => void;
  private readonly read: () => SettingsSnapshot;
  private readonly isCurrent: () => boolean;
  private readonly context: () => common.UIAbilityContext;
  private readonly emitOperation: (projection: SettingsOperationProjection) => void;

  constructor(
    emit: (snapshot: SettingsSnapshot) => void,
    read: () => SettingsSnapshot,
    isCurrent: () => boolean,
    context?: () => common.UIAbilityContext,
    emitOperation: (projection: SettingsOperationProjection) => void = (_projection: SettingsOperationProjection): void => {},
  ) {
    this.emit = emit;
    this.read = read;
    this.isCurrent = isCurrent;
    this.context = context ?? ((): common.UIAbilityContext => ReaderRuntimeOwner.current().getUIAbilityContext());
    this.emitOperation = emitOperation;
  }

  open(): void { this.getOrchestrator().open(); }
  toggle(key: SettingsKey, value: boolean): void { this.getOrchestrator().toggle(key, value); }
  restoreDefaults(): Promise<boolean> { return this.getOrchestrator().restoreDefaults(); }
  reconcile(generation: number): void { this.getOrchestrator().reconcile(generation); }

  private getOrchestrator(): SettingsOrchestrator {
    if (this.orchestrator === undefined || !this.orchestrator.owns(ReaderRuntimeOwner.current())) {
      this.orchestrator = new SettingsOrchestrator(this.emit, this.read, this.isCurrent, this.context(), this.emitOperation);
    }
    return this.orchestrator;
  }
}
