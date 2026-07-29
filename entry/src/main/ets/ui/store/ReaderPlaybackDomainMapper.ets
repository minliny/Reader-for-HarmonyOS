import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import type { ReaderUIJSONPayload, ReaderUIJSONResult, ReaderUIPageLayout } from 'reader_ui_runtime';
import {
  CoreReaderCanonicalLocation,
  ReaderUiState,
} from './ReaderUiState';
import { ReaderBookOpenDomainMapper } from './ReaderBookOpenDomainMapper';
import type { ReaderBookOpenLocationContext } from './ReaderBookOpenDomainMapper';

export interface ReaderPlaybackChapterContext {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterUrl: string;
  content: string;
  canonicalLocation: CoreReaderCanonicalLocation;
  chapter: JsonObject;
}

export interface ReaderPlaybackSlice {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  paragraphIndex: number;
}

export interface ReaderPlaybackTtsPlan {
  raw: JsonObject;
  slices: ReaderPlaybackSlice[];
  sourceCharCount: number;
}

/**
 * Exact Core DTO bound from the correlation-scoped page transaction. The
 * shared runtime deliberately emits an empty reader.progress.update payload;
 * UI aliases are never allowed to supply these durable fields.
 */
export interface ReaderPlaybackProgressUpdate {
  bookId: string;
  sourceId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string;
  deviceId?: string;
  updatedAt?: number;
}

export type ReaderPlaybackQueueState = 'idle' | 'playing' | 'paused' | 'completed' | 'stopped';

export interface ReaderPlaybackQueueSnapshot {
  state: ReaderPlaybackQueueState;
  currentSliceIndex: number;
  totalSlices: number;
  completedSlices: number;
}

export class ReaderPlaybackDomainMapper {
  static bindChapter(state: ReaderUiState): ReaderPlaybackChapterContext {
    const book = state.currentBook;
    const location = state.canonicalReaderLocation;
    if (book === null || book.bookId.length === 0 || location === null ||
      location.bookId !== book.bookId || location.chapterIndex < 0) {
      throw new Error('Reader playback Pilot requires a matching Core canonical chapter');
    }
    const sourceId = book.sourceId ?? '';
    const content = state.chapterContent.join('\n');
    if (sourceId.length === 0 || content.trim().length === 0) {
      throw new Error('Reader playback Pilot requires Core source identity and chapter content');
    }
    let chapterUrl = '';
    let chapterTitle = state.currentChapterTitle;
    for (let index = 0; index < state.chapterToc.length; index += 1) {
      const entry = state.chapterToc[index];
      if (entry.index === location.chapterIndex) {
        chapterUrl = entry.chapterId;
        if (chapterTitle.length === 0) chapterTitle = entry.title;
        break;
      }
    }
    const chapter: JsonObject = {};
    chapter['sourceId'] = sourceId;
    chapter['bookId'] = book.bookId;
    chapter['chapterIndex'] = location.chapterIndex;
    chapter['chapterTitle'] = chapterTitle;
    chapter['chapterUrl'] = chapterUrl;
    return {
      sourceId: sourceId,
      bookId: book.bookId,
      chapterIndex: location.chapterIndex,
      chapterTitle: chapterTitle,
      chapterUrl: chapterUrl,
      content: content,
      canonicalLocation: location,
      chapter: chapter,
    };
  }

  static mapLocation(data: JsonObject, chapter: ReaderPlaybackChapterContext,
    expectedOffset: number): ReaderBookOpenLocationContext {
    const mapped = ReaderBookOpenDomainMapper.mapLocation(data, chapter.bookId, chapter.chapterIndex);
    if (mapped.canonicalLocation.chapterOffset !== expectedOffset) {
      throw new Error(
        `reader.location.resolve offset mismatch expected ${expectedOffset}` +
        ` got ${mapped.canonicalLocation.chapterOffset}`,
      );
    }
    // locationRevision is the Core canonical field. resolverVersion describes
    // the algorithm and must never be copied into the revision slot.
    return mapped;
  }

  static bindProgressUpdate(effectPayload: ReaderUIJSONPayload,
    chapter: ReaderPlaybackChapterContext, layout: ReaderUIPageLayout,
    location: CoreReaderCanonicalLocation): ReaderPlaybackProgressUpdate {
    if (Object.keys(effectPayload).length !== 0) {
      throw new Error('reader.progress.update effect payload must stay empty');
    }
    if (location.bookId !== chapter.bookId || location.chapterIndex !== chapter.chapterIndex ||
      layout.chapterIndex !== chapter.chapterIndex || location.chapterOffset !== layout.chapterOffset ||
      Math.abs(location.chapterProgress - layout.chapterProgress) > 0.000001 ||
      location.locationRevision.trim().length === 0) {
      throw new Error('reader.progress.update requires the matching pending canonical location');
    }
    return {
      bookId: chapter.bookId,
      sourceId: chapter.sourceId,
      chapterIndex: chapter.chapterIndex,
      chapterOffset: layout.chapterOffset,
      chapterProgress: layout.chapterProgress,
      locationRevision: location.locationRevision,
    };
  }

  /**
   * Validate Core's full storage DTO before projecting the intentionally
   * narrower Reader-UI result. Passing the raw Core object to the runtime is
   * forbidden because the typed runtime contract accepts only { stored:true }.
   */
  static mapProgressResult(data: JsonObject,
    expected: ReaderPlaybackProgressUpdate): ReaderUIJSONResult {
    const allowed = [
      'bookId', 'sourceId', 'deviceId', 'updatedAt', 'chapterIndex',
      'chapterOffset', 'chapterProgress', 'stored', 'locationRevision',
    ];
    const keys = Object.keys(data);
    for (let index = 0; index < keys.length; index += 1) {
      if (allowed.indexOf(keys[index]) < 0) {
        throw new Error(`reading.progress.update returned unknown field ${keys[index]}`);
      }
    }

    const bookId = ReaderPlaybackDomainMapper.stringField(data, 'bookId');
    const sourceId = ReaderPlaybackDomainMapper.stringField(data, 'sourceId');
    const chapterIndex = ReaderPlaybackDomainMapper.integerField(data, 'chapterIndex', -1);
    const chapterOffset = ReaderPlaybackDomainMapper.integerField(data, 'chapterOffset', -1);
    const chapterProgressValue = data['chapterProgress'] as Object;
    const chapterProgress = typeof chapterProgressValue === 'number' ? chapterProgressValue : Number.NaN;
    const locationRevision = ReaderPlaybackDomainMapper.stringField(data, 'locationRevision');
    const updatedAt = ReaderPlaybackDomainMapper.integerField(data, 'updatedAt', -1);
    if (bookId !== expected.bookId || sourceId !== expected.sourceId ||
      chapterIndex !== expected.chapterIndex || chapterOffset !== expected.chapterOffset ||
      !Number.isFinite(chapterProgress) ||
      Math.abs(chapterProgress - expected.chapterProgress) > 0.000001 ||
      locationRevision !== expected.locationRevision || updatedAt < 0 || data['stored'] !== true) {
      throw new Error('reading.progress.update returned a mismatched durable progress row');
    }

    const rawDeviceId = data['deviceId'] as Object;
    if (expected.deviceId === undefined) {
      if (rawDeviceId !== undefined && rawDeviceId !== null) {
        throw new Error('reading.progress.update returned an unexpected deviceId');
      }
    } else if (typeof rawDeviceId !== 'string' || rawDeviceId !== expected.deviceId) {
      throw new Error('reading.progress.update returned a mismatched deviceId');
    }
    if (expected.updatedAt !== undefined && updatedAt !== expected.updatedAt) {
      throw new Error('reading.progress.update returned a mismatched updatedAt');
    }
    return { 'stored': true };
  }

  static mapTtsPlan(data: JsonObject, chapter: ReaderPlaybackChapterContext): ReaderPlaybackTtsPlan {
    const plan = ReaderPlaybackDomainMapper.objectField(data, 'plan');
    if (plan === undefined) throw new Error('Core tts.slice did not return plan');
    const planChapter = ReaderPlaybackDomainMapper.objectField(plan, 'chapter');
    if (planChapter === undefined ||
      ReaderPlaybackDomainMapper.stringField(planChapter, 'sourceId') !== chapter.sourceId ||
      ReaderPlaybackDomainMapper.stringField(planChapter, 'bookId') !== chapter.bookId ||
      ReaderPlaybackDomainMapper.integerField(planChapter, 'chapterIndex', -1) !== chapter.chapterIndex) {
      throw new Error('Core tts.slice returned a plan for another chapter');
    }
    const rawSlices = ReaderPlaybackDomainMapper.arrayField(plan, 'slices');
    const slices: ReaderPlaybackSlice[] = [];
    for (let index = 0; index < rawSlices.length; index += 1) {
      const raw = rawSlices[index] as Object as JsonObject;
      const sliceIndex = ReaderPlaybackDomainMapper.integerField(raw, 'index', -1);
      const text = ReaderPlaybackDomainMapper.stringField(raw, 'text');
      const charStart = ReaderPlaybackDomainMapper.integerField(raw, 'charStart', -1);
      const charEnd = ReaderPlaybackDomainMapper.integerField(raw, 'charEnd', -1);
      const paragraphIndex = ReaderPlaybackDomainMapper.integerField(raw, 'paragraphIndex', -1);
      if (sliceIndex !== index || text.trim().length === 0 || charStart < 0 ||
        charEnd <= charStart || paragraphIndex < 0) {
        throw new Error(`Core tts.slice returned malformed slice ${index}`);
      }
      slices.push({
        index: sliceIndex,
        text: text,
        charStart: charStart,
        charEnd: charEnd,
        paragraphIndex: paragraphIndex,
      });
    }
    if (slices.length === 0) throw new Error('Core tts.slice returned an empty plan');
    const sourceCharCount = ReaderPlaybackDomainMapper.integerField(plan, 'sourceCharCount', -1);
    if (sourceCharCount < 0) throw new Error('Core tts.slice returned invalid sourceCharCount');
    return { raw: plan, slices: slices, sourceCharCount: sourceCharCount };
  }

  static mapQueueSnapshot(data: JsonObject, expectedTotal: number): ReaderPlaybackQueueSnapshot {
    const snapshot = ReaderPlaybackDomainMapper.objectField(data, 'snapshot');
    if (snapshot === undefined) throw new Error('Core TTS queue command did not return snapshot');
    const stateValue = ReaderPlaybackDomainMapper.stringField(snapshot, 'state');
    if (stateValue !== 'idle' && stateValue !== 'playing' && stateValue !== 'paused' &&
      stateValue !== 'completed' && stateValue !== 'stopped') {
      throw new Error(`Core TTS queue returned invalid state ${stateValue}`);
    }
    const total = ReaderPlaybackDomainMapper.integerField(snapshot, 'totalSlices', -1);
    const current = ReaderPlaybackDomainMapper.integerField(snapshot, 'currentSliceIndex', -1);
    const completed = ReaderPlaybackDomainMapper.integerField(snapshot, 'completedSlices', -1);
    if (total !== expectedTotal || current < 0 || current >= Math.max(1, total) ||
      completed < 0 || completed > total) {
      throw new Error('Core TTS queue returned an invalid cursor snapshot');
    }
    return {
      state: stateValue as ReaderPlaybackQueueState,
      currentSliceIndex: current,
      totalSlices: total,
      completedSlices: completed,
    };
  }

  private static objectField(data: JsonObject, key: string): JsonObject | undefined {
    const value = data[key] as Object;
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      return value as Object as JsonObject;
    }
    return undefined;
  }

  private static arrayField(data: JsonObject, key: string): Object[] {
    const value = data[key] as Object;
    return Array.isArray(value) ? value as Object[] : [];
  }

  private static stringField(data: JsonObject, key: string): string {
    const value = data[key] as Object;
    return typeof value === 'string' ? value : '';
  }

  private static integerField(data: JsonObject, key: string, fallback: number): number {
    const value = data[key] as Object;
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  }
}
