// ReadingFlowStateMachine — reader state management
export enum ReadingState {
  IDLE = 'IDLE',
  TOC_LOADING = 'TOC_LOADING',
  TOC_READY = 'TOC_READY',
  CHAPTER_LOADING = 'CHAPTER_LOADING',
  CHAPTER_READY = 'CHAPTER_READY',
  ERROR = 'ERROR'
}

export interface ReadingContext {
  bookId: string;
  detailURL: string;
  currentChapterIndex: number;
  totalChapters: number;
}

const validTransitions: Record<ReadingState, ReadingState[]> = {
  [ReadingState.IDLE]: [ReadingState.TOC_LOADING],
  [ReadingState.TOC_LOADING]: [ReadingState.TOC_READY, ReadingState.ERROR],
  [ReadingState.TOC_READY]: [ReadingState.CHAPTER_LOADING, ReadingState.IDLE],
  [ReadingState.CHAPTER_LOADING]: [ReadingState.CHAPTER_READY, ReadingState.ERROR],
  [ReadingState.CHAPTER_READY]: [ReadingState.CHAPTER_LOADING, ReadingState.IDLE],
  [ReadingState.ERROR]: [ReadingState.IDLE, ReadingState.TOC_LOADING, ReadingState.CHAPTER_LOADING]
};

export class ReadingFlowStateMachine {
  private state: ReadingState;
  private context: ReadingContext | null;

  constructor() {
    this.state = ReadingState.IDLE;
    this.context = null;
  }

  getState(): ReadingState { return this.state; }
  getContext(): ReadingContext | null { return this.context; }

  openBook(bookId: string, detailURL: string): boolean {
    if (this.state !== ReadingState.IDLE) { return false; }
    this.context = { bookId, detailURL, currentChapterIndex: 0, totalChapters: 0 };
    return this.transition(ReadingState.TOC_LOADING);
  }

  tocLoaded(totalChapters: number): boolean {
    if (!this.context) { return false; }
    this.context.totalChapters = totalChapters;
    return this.transition(ReadingState.TOC_READY);
  }

  selectChapter(index: number): boolean {
    if (this.state !== ReadingState.TOC_READY) { return false; }
    if (!this.context) { return false; }
    if (index < 0 || index >= this.context.totalChapters) { return false; }
    this.context.currentChapterIndex = index;
    return this.transition(ReadingState.CHAPTER_LOADING);
  }

  chapterLoaded(): boolean {
    return this.transition(ReadingState.CHAPTER_READY);
  }

  nextChapter(): boolean {
    if (this.state !== ReadingState.CHAPTER_READY) { return false; }
    if (!this.context) { return false; }
    if (this.context.currentChapterIndex >= this.context.totalChapters - 1) { return false; }
    this.context.currentChapterIndex++;
    return this.transition(ReadingState.CHAPTER_LOADING);
  }

  prevChapter(): boolean {
    if (this.state !== ReadingState.CHAPTER_READY) { return false; }
    if (!this.context) { return false; }
    if (this.context.currentChapterIndex <= 0) { return false; }
    this.context.currentChapterIndex--;
    return this.transition(ReadingState.CHAPTER_LOADING);
  }

  closeBook(): boolean {
    if (this.state === ReadingState.IDLE) { return false; }
    this.context = null;
    return this.transition(ReadingState.IDLE);
  }

  setError(): boolean {
    return this.transition(ReadingState.ERROR);
  }

  retry(): boolean {
    if (this.state !== ReadingState.ERROR) { return false; }
    return this.transition(ReadingState.IDLE);
  }

  canNavigate(): boolean {
    return this.state === ReadingState.CHAPTER_READY;
  }

  private transition(to: ReadingState): boolean {
    const allowed = validTransitions[this.state];
    if (!allowed || allowed.indexOf(to) === -1) { return false; }
    this.state = to;
    return true;
  }
}
