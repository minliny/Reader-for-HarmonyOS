import type { ReaderBrightnessWriter } from '../../../app/ReaderBrightnessWriter';
import { readerBrightnessWindowValue, readerBrightnessControlPercent, readerBrightnessSystemValue } from './ReaderBrightnessCurve';

export interface ReaderBrightnessSessionHost {
  writer(): ReaderBrightnessWriter;
  isMounted(): boolean;
  observeSystemBrightness(): Promise<string> | undefined;
  readAutomatic(): boolean;
  readPercent(): number;
  publishAutomatic(automatic: boolean): void;
  publishPercent(percent: number): void;
  publishRevision(): void;
  reportFailure(operation: string, error: Error): void;
}

/** Holds the reader's current brightness intent. The window writer owns the
 * native write queue and restoration baseline, while the page owns the rail. */
export class ReaderBrightnessSession {
  private brightnessRequestGeneration: number = 0;
  private brightnessOwner: number = 0;
  private brightnessAutomaticIntent: boolean | undefined = undefined;
  private systemBrightnessRead: Promise<number | undefined> | undefined = undefined;
  private readonly host: ReaderBrightnessSessionHost;

  constructor(host: ReaderBrightnessSessionHost) { this.host = host; }

  automatic(): boolean {
    return this.brightnessAutomaticIntent ?? this.host.readAutomatic();
  }

  private claim(): number {
    if (this.brightnessOwner === 0) {
      this.brightnessOwner = this.host.writer().claim();
    }
    return this.brightnessOwner;
  }

  refresh(): void {
    // Opening controls observes the window; it must not cancel a pending user intent.
    const generation = this.brightnessRequestGeneration;
    const owner = this.claim();
    void this.host.writer().read(owner).then((result): void => {
      if (result.applied && this.host.isMounted() && generation === this.brightnessRequestGeneration &&
        this.brightnessAutomaticIntent === undefined) {
        this.admit(result.value);
        this.host.publishRevision();
        if (result.value < 0) this.refreshSystemBrightness(generation);
      }
    }).catch((error: Error): void => {
      this.host.reportFailure('read', error);
    });
  }

  private readSystemBrightnessValue(): Promise<number | undefined> {
    if (this.systemBrightnessRead !== undefined) return this.systemBrightnessRead;
    try {
      const rawReading = this.host.observeSystemBrightness();
      if (rawReading === undefined) return Promise.resolve(undefined);
      const observation = rawReading
        .then((raw: string): number | undefined => readerBrightnessSystemValue(raw))
        .catch((_error: Error): undefined => undefined);
      this.systemBrightnessRead = observation;
      void observation.then((): void => {
        if (this.systemBrightnessRead === observation) this.systemBrightnessRead = undefined;
      });
      return observation;
    } catch (_error) { return Promise.resolve(undefined); }
  }

  private refreshSystemBrightness(generation: number): void {
    void this.readSystemBrightnessValue().then((value: number | undefined): void => {
      if (value !== undefined && this.host.isMounted() && generation === this.brightnessRequestGeneration &&
        this.host.readAutomatic() && this.brightnessAutomaticIntent !== false) {
        this.host.publishPercent(readerBrightnessControlPercent(value));
        this.host.publishRevision();
      }
    });
  }

  setManual(percent: number): void {
    if (!Number.isFinite(percent)) return;
    this.enqueue(readerBrightnessWindowValue(percent), 'manual');
  }

  toggleAutomatic(): void {
    const automatic = this.automatic();
    if (!automatic) { this.enqueue(-1, 'automatic'); return; }
    // Do not jump to the initial/old rail position while the first system read
    // is pending. A second tap or manual drag invalidates this pending intent.
    const generation = ++this.brightnessRequestGeneration;
    this.brightnessAutomaticIntent = false;
    void this.readSystemBrightnessValue().then((value: number | undefined): void => {
      if (this.host.isMounted() && generation === this.brightnessRequestGeneration &&
        this.brightnessAutomaticIntent === false) {
        this.enqueue(value ?? readerBrightnessWindowValue(this.host.readPercent()), 'manual');
      }
    });
  }

  cancel(): void {
    const generation = ++this.brightnessRequestGeneration;
    const owner = this.brightnessOwner;
    if (owner === 0) return;
    // Cancel removes only unsent pointer samples. The shared writer must first
    // account for an issued native call before the preview admits its final ACK.
    void this.host.writer().cancelAndSettle(owner)
      .then((result): void => {
        if (result.applied && this.host.isMounted() && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.admit(result.value);
          this.host.publishRevision();
        }
      }).catch((error: Error): void => {
        if (this.host.isMounted() && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.host.reportFailure('cancel', error);
          this.refresh();
        }
      });
  }

  private enqueue(target: number, mode: 'manual' | 'automatic'): void {
    this.brightnessAutomaticIntent = mode === 'automatic';
    const generation = ++this.brightnessRequestGeneration;
    const owner = this.claim();
    // The window-wide writer merges pending samples while retaining an active
    // lookup/write. Request IDs only guard UI acknowledgements, not native work.
    void this.host.writer().request(owner, target)
      .then((result): void => {
        if (result.applied && this.host.isMounted() && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.admit(result.value);
          this.host.publishRevision();
          if (result.value < 0) this.refreshSystemBrightness(generation);
        }
      }).catch((error: Error): void => {
        if (this.host.isMounted() && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.host.reportFailure(mode, error);
          this.refresh();
        }
      });
  }

  private admit(brightness: number): void {
    if (!Number.isFinite(brightness)) return;
    this.host.publishAutomatic(brightness < 0);
    if (brightness >= 0) {
      this.host.publishPercent(readerBrightnessControlPercent(brightness));
    }
  }

  restore(): void {
    this.brightnessRequestGeneration += 1;
    const owner = this.brightnessOwner;
    this.brightnessOwner = 0;
    if (owner === 0) return;
    void this.host.writer().release(owner)
      .then((): void => {}).catch((error: Error): void => {
        this.host.reportFailure('exit restore', error);
      });
  }
}
