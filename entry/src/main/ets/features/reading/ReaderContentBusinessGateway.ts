import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';

export type ReaderContentEdit = {
  editId: number;
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  editedContent: string;
  editedAt: number;
};

export type ReaderChapterReview = {
  author: string;
  content: string;
  postTime: string;
  rating: string;
  reviewUrl: string | undefined;
};

/**
 * Typed boundary for Legado's ContentEditDialog and chapter-review tools.
 * Core remains the only owner of edit persistence and review-rule execution;
 * this gateway only validates the exact values admitted into ArkUI.
 */
export class ReaderContentBusinessGateway {
  private readonly runtimeOwner: ReadingGatewayRuntime;

  constructor(runtimeOwner: ReadingGatewayRuntime) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadEdit(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
  ): Promise<ReaderContentEdit | undefined> {
    this.assertIdentity(sourceId, bookId, chapterIndex);
    const result = await this.runtimeOwner.request('content-edit.get', {
      sourceId,
      bookId,
      chapterIndex,
    });
    const rawEdit = result.data['edit'];
    if (rawEdit === undefined || rawEdit === null) {
      return undefined;
    }
    const edit = this.decodeEdit(rawEdit, 'content-edit.get');
    this.assertEditIdentity(edit, sourceId, bookId, chapterIndex, 'content-edit.get');
    return edit;
  }

  async saveEdit(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    editedContent: string,
  ): Promise<ReaderContentEdit> {
    this.assertIdentity(sourceId, bookId, chapterIndex);
    if (editedContent.trim().length === 0) {
      throw new Error('edited chapter content must not be blank');
    }
    const editedAt = Date.now();
    const result = await this.runtimeOwner.request('content-edit.put', {
      sourceId,
      bookId,
      chapterIndex,
      editedContent,
      editedAt,
    });
    const edit = this.decodeEdit(result.data['edit'], 'content-edit.put');
    this.assertEditIdentity(edit, sourceId, bookId, chapterIndex, 'content-edit.put');
    if (edit.editedContent !== editedContent || edit.editedAt !== editedAt) {
      throw new Error('content-edit.put returned a mismatched edit');
    }
    return edit;
  }

  async deleteEdit(editId: number): Promise<void> {
    if (!Number.isSafeInteger(editId) || editId < 0) {
      throw new Error('content-edit.delete requires a non-negative editId');
    }
    const result = await this.runtimeOwner.request('content-edit.delete', { editId });
    const deleted = result.data['deleted'];
    if (deleted !== 1) {
      throw new Error('content-edit.delete did not delete the selected edit');
    }
  }

  async loadChapterReviews(
    sourceId: string,
    bookId: string,
    chapterUrl: string,
  ): Promise<ReaderChapterReview[]> {
    const normalizedUrl = chapterUrl.trim();
    this.assertIdentity(sourceId, bookId, 0);
    if (sourceId === 'local') {
      throw new Error('local books do not have source-backed chapter reviews');
    }
    if (normalizedUrl.length === 0) {
      throw new Error('chapter reviews require a chapter URL');
    }
    const result = await this.runtimeOwner.request('book.chapterReview', {
      sourceId,
      bookId,
      chapterUrl: normalizedUrl,
      reviewUrl: normalizedUrl,
    });
    if (result.data['sourceId'] !== sourceId || result.data['bookId'] !== bookId) {
      throw new Error('book.chapterReview returned a mismatched identity');
    }
    const rawReviews = result.data['reviews'];
    if (!Array.isArray(rawReviews)) {
      throw new Error('book.chapterReview returned invalid reviews');
    }
    const reviews: ReaderChapterReview[] = [];
    for (const rawReview of rawReviews) {
      reviews.push(this.decodeReview(rawReview));
    }
    return reviews;
  }

  private decodeEdit(value: unknown, context: string): ReaderContentEdit {
    const raw = this.requireObject(value, `${context} edit`);
    return {
      editId: this.requireNonNegativeInteger(raw, 'editId', context),
      sourceId: this.requireNonBlankString(raw, 'sourceId', context),
      bookId: this.requireNonBlankString(raw, 'bookId', context),
      chapterIndex: this.requireNonNegativeInteger(raw, 'chapterIndex', context),
      editedContent: this.requireString(raw, 'editedContent', context),
      editedAt: this.requireNonNegativeInteger(raw, 'editedAt', context),
    };
  }

  private decodeReview(value: unknown): ReaderChapterReview {
    const raw = this.requireObject(value, 'book.chapterReview review');
    const review: ReaderChapterReview = {
      author: this.optionalString(raw, 'author', 'book.chapterReview') ?? '',
      content: this.optionalString(raw, 'content', 'book.chapterReview') ?? '',
      postTime: this.optionalString(raw, 'postTime', 'book.chapterReview') ?? '',
      rating: this.optionalString(raw, 'rating', 'book.chapterReview') ?? '',
      reviewUrl: this.optionalString(raw, 'reviewUrl', 'book.chapterReview'),
    };
    if (review.author.length === 0 && review.content.length === 0 &&
      review.postTime.length === 0 && review.rating.length === 0) {
      throw new Error('book.chapterReview returned an empty review');
    }
    return review;
  }

  private assertEditIdentity(
    edit: ReaderContentEdit,
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    context: string,
  ): void {
    if (edit.sourceId !== sourceId || edit.bookId !== bookId || edit.chapterIndex !== chapterIndex) {
      throw new Error(`${context} returned a mismatched edit identity`);
    }
  }

  private assertIdentity(sourceId: string, bookId: string, chapterIndex: number): void {
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) {
      throw new Error('content business identity must not be blank');
    }
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
      throw new Error('content business chapterIndex must be non-negative');
    }
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context} is not an object`);
    }
    return value as JsonObject;
  }

  private requireString(value: JsonObject, key: string, context: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonBlankString(value: JsonObject, key: string, context: string): string {
    const candidate = this.requireString(value, key, context);
    if (candidate.trim().length === 0) {
      throw new Error(`${context} returned blank ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string, context: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonNegativeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }
}
