export interface SourceSwitchSurfaceSnapshot {
  attachment: number;
  attached: boolean;
  closing: boolean;
}

/** One source-picker carrier only; this owns no Host visibility or transaction. */
export class SourceSwitchSurfaceLifecycle {
  private generation: number = 0;
  private attachment: number = 0;
  private scope: number = -1;
  private closing: boolean = false;
  private parts: string[] = [];
  private readonly changed: (snapshot: SourceSwitchSurfaceSnapshot) => void;

  constructor(changed: (snapshot: SourceSwitchSurfaceSnapshot) => void) { this.changed = changed; }

  attach(scope: number): number {
    this.attachment = ++this.generation;
    this.scope = scope;
    this.closing = false;
    this.parts = [];
    this.publish();
    return this.attachment;
  }

  current(attachment: number, scope: number): boolean {
    return attachment > 0 && attachment === this.attachment && scope === this.scope;
  }

  appeared(attachment: number, scope: number, part: string): void {
    if (!this.current(attachment, scope) || this.closing || this.parts.includes(part)) return;
    this.parts = [...this.parts, part];
  }

  hide(attachment: number, scope: number, reduceMotion: boolean): boolean {
    if (!this.current(attachment, scope)) return false;
    this.closing = true;
    if (reduceMotion || this.parts.length === 0) return this.finish(attachment, scope);
    this.publish();
    return false;
  }

  transitionFinished(attachment: number, scope: number, part: string, transitionIn: boolean): boolean {
    if (transitionIn || !this.current(attachment, scope) || !this.parts.includes(part)) return false;
    this.parts = this.parts.filter((candidate: string): boolean => candidate !== part);
    return this.closing && this.parts.length === 0 ? this.finish(attachment, scope) : false;
  }

  private finish(attachment: number, scope: number): boolean {
    if (!this.current(attachment, scope)) return false;
    this.attachment = 0;
    this.scope = -1;
    this.parts = [];
    this.closing = false;
    this.publish();
    return true;
  }

  detach(attachment: number, scope: number): void {
    if (this.current(attachment, scope)) this.retire();
  }

  retire(): void {
    this.generation += 1;
    this.attachment = 0;
    this.scope = -1;
    this.parts = [];
    this.closing = false;
    this.publish();
  }

  private publish(): void {
    this.changed({ attachment: this.attachment, attached: this.attachment > 0, closing: this.closing });
  }
}

/** Stable IDs owned by actual source-picker triggers, not UI layout policy. */
export function sourceSwitchTriggerFocusId(sourceId: string, bookId: string, role: string): string {
  return `reader-source-trigger:${JSON.stringify([sourceId, bookId, role])}`;
}
