import type { UIContext } from '@ohos.arkui.UIContext';

export const READER_TRANSIENT_TOAST_STORAGE_KEY: string = 'readerTransientToast';
export const READER_TRANSIENT_HOST_STORAGE_KEY: string = 'readerTransientHost';

/** Shared display windows for short feedback. Routine receipts use brief;
 * route/recovery facts with more text keep the extended reading beat. */
export const READER_FEEDBACK_BRIEF_MS: 2000 = 2000;
export const READER_FEEDBACK_EXTENDED_MS: 2200 = 2200;
/** Repeated facts from the same owner inside this window are deduplicated. */
export const READER_FEEDBACK_DEDUPE_MS: 2000 = 2000;

interface ReaderTransientHostRegistration { id: number; priority: number; }
let nextHostId: number = 0;
const transientHosts: ReaderTransientHostRegistration[] = [];
let announcedGeneration: number = -1;

export interface ReaderTransientTextObserver {
  readonly textOptions: (message: string) => TextOptions | undefined;
  readonly onPublished: (generation: number, durationMs: number) => void;
  readonly onLayout: (generation: number, hostId: number, durationMs: number) => boolean;
  readonly onRetired: (generation: number, durationMs: number) => void;
}

interface ReaderTransientTextRegistration {
  readonly generation: number;
  readonly durationMs: number;
  readonly observer: ReaderTransientTextObserver;
}

// The optional observer belongs to one published generation and stays outside AppStorage.
let transientTextRegistration: ReaderTransientTextRegistration | undefined;

export function readerTransientTextObserver(generation: number, hostId: number): ReaderTransientTextObserver | undefined {
  const registration = transientTextRegistration;
  if (registration === undefined || registration.generation !== generation || hostId <= 0) return undefined;
  const toast = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
  if (toast?.visible !== true || toast.generation !== generation ||
    AppStorage.get<number>(READER_TRANSIENT_HOST_STORAGE_KEY) !== hostId ||
    AppStorage.get<boolean>('readerAppForeground') === false) return undefined;
  return registration.observer;
}

function notifyTransientTextRetired(registration: ReaderTransientTextRegistration | undefined): void {
  if (registration === undefined) return;
  try { registration.observer.onRetired(registration.generation, registration.durationMs); } catch (_) {}
}

/** Claims one announcement attempt across every foreground presentation host. */
export function claimReaderTransientAnnouncement(hostId: number, generation: number): string | undefined {
  const current = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
  if (hostId <= 0 || !transientHosts.some((host: ReaderTransientHostRegistration): boolean => host.id === hostId) ||
    AppStorage.get<number>(READER_TRANSIENT_HOST_STORAGE_KEY) !== hostId ||
    AppStorage.get<boolean>('readerAppForeground') === false || current?.visible !== true ||
    !Number.isSafeInteger(generation) || generation <= announcedGeneration || current.generation !== generation ||
    current.message.trim().length === 0) return undefined;
  announcedGeneration = generation;
  const title = current.title.trim();
  return title.length > 0 ? `${title}。${current.message.trim()}` : current.message.trim();
}

/** Native covers/sheets have their own compositor layer. Exactly one shared
 * host presents a fact; changing layers retires the prior presentation. */
function publishTransientHost(): void {
  let active: ReaderTransientHostRegistration | undefined = undefined;
  transientHosts.forEach((host: ReaderTransientHostRegistration): void => {
    if (active === undefined || host.priority >= active.priority) active = host;
  });
  const id = active?.id ?? 0;
  const previous = AppStorage.get<number>(READER_TRANSIENT_HOST_STORAGE_KEY) ?? 0;
  if (previous === id) return;
  const toast = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
  if (previous > 0 && toast?.visible) retireReaderTransientToast(toast.generation);
  AppStorage.setOrCreate<number>(READER_TRANSIENT_HOST_STORAGE_KEY, id);
}

export function registerReaderTransientHost(priority: number): number {
  const id = ++nextHostId;
  transientHosts.push({ id, priority });
  publishTransientHost();
  return id;
}

export function unregisterReaderTransientHost(id: number): void {
  const index = transientHosts.findIndex((host: ReaderTransientHostRegistration): boolean => host.id === id);
  if (index < 0) return;
  transientHosts.splice(index, 1);
  publishTransientHost();
}

export function retireReaderTransientToast(generation: number): void {
  const current = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
  if (current === undefined || current.generation !== generation) return;
  AppStorage.setOrCreate<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY, {
    visible: false, generation: current.generation, title: current.title, message: current.message,
    duration: current.duration, key: current.key, tone: current.tone,
  });
  if (transientTextRegistration?.generation === generation) {
    const retired = transientTextRegistration;
    transientTextRegistration = undefined;
    notifyTransientTextRetired(retired);
  }
}


/** State published by the domain-neutral short-feedback adapter. The visual
 * host owns rendering and dismissal; owners only publish a fact and retain
 * their existing operation authority. */
export interface ReaderTransientToastState {
  visible: boolean;
  generation: number;
  title: string;
  message: string;
  duration: number;
  key: string;
  tone: 'info' | 'success' | 'error';
}

export function createReaderTransientToastState(): ReaderTransientToastState {
  return {
    visible: false,
    generation: 0,
    title: '',
    message: '',
    duration: READER_FEEDBACK_BRIEF_MS,
    key: '',
    tone: 'info',
  };
}

export interface ReaderTransientFeedbackOptions {
  message: string;
  duration?: 2000 | 2200;
  key?: string;
  dedupeMs?: number;
  /** Optional title for a fact with a useful secondary detail. */
  title?: string;
  tone?: 'info' | 'success' | 'error';
  textObserver?: ReaderTransientTextObserver;
}

/** One mounted host's short feedback. Domain owners retain completion, retry
 * and navigation authority. This adapter neither queues nor persists work. */
export class ReaderTransientFeedback {
  private lastKey: string = '';
  private lastShownAt: number = -1;
  private lastPublishedGeneration: number = -1;

  show(context: () => UIContext, options: ReaderTransientFeedbackOptions, isCurrent: () => boolean): boolean {
    try {
      if (AppStorage.get<boolean>('readerAppForeground') === false ||
        !isCurrent() || options.message.trim().length === 0) return false;
      const now = Date.now();
      const key = options.key ?? options.message;
      const dedupeMs = options.dedupeMs ?? READER_FEEDBACK_DEDUPE_MS;
      if (this.lastKey === key && now >= this.lastShownAt && now - this.lastShownAt < dedupeMs) return false;
      // Validate the mounted owner context before publishing to the root host.
      // No platform prompt API is used by this adapter.
      context();
      if (AppStorage.get<boolean>('readerAppForeground') === false || !isCurrent()) return false;
      const previous = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY) ??
        createReaderTransientToastState();
      const generation = Number.isSafeInteger(previous.generation) ? previous.generation + 1 : 1;
      const duration = options.duration ?? READER_FEEDBACK_BRIEF_MS;
      const previousText = transientTextRegistration;
      const registration: ReaderTransientTextRegistration | undefined = options.textObserver === undefined ? undefined :
        { generation, durationMs: duration, observer: options.textObserver };
      transientTextRegistration = registration;
      try {
        AppStorage.setOrCreate<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY, {
          visible: true,
          generation,
          title: options.title?.trim() ?? '',
          message: options.message.trim(),
          duration,
          key,
          tone: options.tone ?? 'info',
        });
      } catch (error) {
        if (transientTextRegistration === registration) transientTextRegistration = previousText;
        throw error;
      }
      this.lastKey = key;
      this.lastShownAt = now;
      this.lastPublishedGeneration = generation;
      if (registration !== undefined || previousText !== undefined) {
        try {
          const published = AppStorage.get<ReaderTransientToastState>(READER_TRANSIENT_TOAST_STORAGE_KEY);
          if (published?.visible === true && published.generation === generation) {
            notifyTransientTextRetired(previousText);
            if (registration !== undefined && transientTextRegistration === registration) {
              registration.observer.onPublished(generation, duration);
            }
          } else if (transientTextRegistration === registration) {
            transientTextRegistration = previousText;
          }
        } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  reset(): void {
    // Retire only this adapter's currently published fact. Several mounted
    // owners can share the root host during route transitions; one owner's
    // teardown must not dismiss a newer generation from another owner.
    try { retireReaderTransientToast(this.lastPublishedGeneration); }
    catch (_) { /* Cleanup cannot interfere with the domain teardown. */ }
    this.lastKey = '';
    this.lastShownAt = -1;
    this.lastPublishedGeneration = -1;
  }
}
