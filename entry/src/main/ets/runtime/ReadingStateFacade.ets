// ReadingStateFacade - Phase 2 ArkTS Runtime Facade。
// 管理阅读状态（当前章节、进度、书签），输出 Core-compatible stage report。
//
// 对齐 Core: ReadingFlowModels / group/bookmark/stat/progress DTO 语义。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface ReadingState {
  bookId: string;
  currentChapterIndex: number;
  chapterProgress: number;
  totalChapters: number;
  lastReadAt: number;
}

export interface Bookmark {
  bookId: string;
  chapterIndex: number;
  chapterProgress: number;
  label: string;
  createdAt: number;
}

export interface ReadingStateStageReport extends RuntimeStageReport {
  facadeIdentifier: 'ReadingStateFacade';
  stageName: 'reading_state';
}

const FACADE_ID = 'ReadingStateFacade';
const STAGE_NAME = 'reading_state';

export class ReadingStateFacade {
  private states: Map<string, ReadingState> = new Map();
  private bookmarks: Bookmark[] = [];

  saveState(state: ReadingState): void {
    this.states.set(state.bookId, state);
  }

  loadState(bookId: string): ReadingState | undefined {
    return this.states.get(bookId);
  }

  addBookmark(bookmark: Bookmark): void {
    this.bookmarks.push(bookmark);
  }

  listBookmarks(bookId: string): Bookmark[] {
    return this.bookmarks.filter(b => b.bookId === bookId);
  }

  buildStageReport(): ReadingStateStageReport {
    const state: ReadingState = {
      bookId: 'fixture-book-001',
      currentChapterIndex: 3,
      chapterProgress: 0.5,
      totalChapters: 12,
      lastReadAt: Date.now()
    };
    this.saveState(state);

    const bookmark: Bookmark = {
      bookId: 'fixture-book-001',
      chapterIndex: 3,
      chapterProgress: 0.5,
      label: 'Fixture bookmark',
      createdAt: Date.now()
    };
    this.addBookmark(bookmark);

    const loaded = this.loadState('fixture-book-001');
    const bookmarks = this.listBookmarks('fixture-book-001');

    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'state.save', `state saved bookId:${loaded?.bookId}`),
      passedCase(FACADE_ID, STAGE_NAME, 'state.load', `state loaded chapter:${loaded?.currentChapterIndex}`),
      passedCase(FACADE_ID, STAGE_NAME, 'state.progress', `progress:${loaded?.chapterProgress}`),
      passedCase(FACADE_ID, STAGE_NAME, 'bookmark.add', `bookmark added`),
      passedCase(FACADE_ID, STAGE_NAME, 'bookmark.list', `bookmarks count:${bookmarks.length}`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as ReadingStateStageReport;
  }
}
