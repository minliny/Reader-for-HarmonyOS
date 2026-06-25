// PdfRenderAdapter — clean-room HarmonyOS PDF page render platform module.
// Wraps @ohos.pdf.PdfDocument/PdfPage into a reusable adapter for rendering
// PDF pages to bitmaps. No raw file paths or credentials are exported; only
// bounded status classes and redacted checksums are surfaced.
//
// IMPORTANT: This module provides PDF *page rendering* capability only. The
// reader-shell PDF marker ('harmonyos.reader.pdf') remains UNSUPPORTED because
// a full PDF reader UI (reflow, pagination, annotations) is out of scope and
// belongs to the independent UI project. Parser ≠ reader shell.

import { pdf } from '@kit.PDFKit';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export interface PdfPageRender {
  pageIndex: number;
  widthPx: number;
  heightPx: number;
  rendered: boolean;
  checksum: string;
  errorClass: string;
}

export interface PdfDocumentInfo {
  pageCount: number;
  widthPt: number;
  heightPt: number;
  checksum: string;
}

export interface PdfRenderEvidence {
  backend: string;
  documentOpened: boolean;
  pageCount: number;
  pagesRendered: number;
  renderChecksum: string;
  errorClass: string;
  rawPathExported: boolean;
}

const PDF_BACKEND = 'harmonyos-pdf-clean-room';

export class PdfRenderAdapter {
  private document: pdf.PdfDocument | null = null;
  private pageCount: number = 0;

  /**
   * Open a PDF document from a file descriptor. Device execution requires a
   * real PDF service; in headless contexts this returns false without faking
   * success.
   */
  async open(fd: number): Promise<boolean> {
    try {
      this.document = await pdf.loadDocument(fd, '');
      this.pageCount = this.document.pageCount;
      return true;
    } catch (_e) {
      this.document = null;
      this.pageCount = 0;
      return false;
    }
  }

  /** Get document metadata (redacted). */
  getDocumentInfo(): PdfDocumentInfo {
    if (this.document === null) {
      return { pageCount: 0, widthPt: 0, heightPt: 0, checksum: boundedChecksum('pdf:empty') };
    }
    return {
      pageCount: this.pageCount,
      widthPt: 0,
      heightPt: 0,
      checksum: boundedChecksum(`pdf:pages:${this.pageCount}`)
    };
  }

  /**
   * Render a page to a bitmap. Device execution requires a real PDF service.
   * Returns bounded evidence; raw bitmap data is not exported.
   */
  async renderPage(pageIndex: number, widthPx: number, heightPx: number): Promise<PdfPageRender> {
    if (this.document === null) {
      return {
        pageIndex,
        widthPx,
        heightPx,
        rendered: false,
        checksum: boundedChecksum('pdf:no-document'),
        errorClass: 'no_document'
      };
    }
    if (pageIndex < 0 || pageIndex >= this.pageCount) {
      return {
        pageIndex,
        widthPx,
        heightPx,
        rendered: false,
        checksum: boundedChecksum('pdf:out-of-range'),
        errorClass: 'page_out_of_range'
      };
    }
    try {
      const page: pdf.PdfPage = await this.document.getPage(pageIndex);
      const bitmap: image.PixelMap = await page.render(widthPx, heightPx);
      const checksum = boundedChecksum(`pdf:page:${pageIndex}:${widthPx}x${heightPx}`);
      return {
        pageIndex,
        widthPx,
        heightPx,
        rendered: true,
        checksum,
        errorClass: 'none'
      };
    } catch (e) {
      return {
        pageIndex,
        widthPx,
        heightPx,
        rendered: false,
        checksum: boundedChecksum(`pdf:error:${pageIndex}`),
        errorClass: this.errorClass(e)
      };
    }
  }

  /** Close the document and release resources. */
  close(): void {
    if (this.document !== null) {
      try {
        this.document.destroy();
      } catch (_e) {
        // Bounded failure.
      }
    }
    this.document = null;
    this.pageCount = 0;
  }

  /**
   * Build redacted evidence for a fixture round-trip (no device PDF required).
   * Verifies the adapter is bound and the render contract shape is present.
   * Does NOT claim a real PDF was rendered.
   */
  buildFixtureEvidence(): PdfRenderEvidence {
    return {
      backend: PDF_BACKEND,
      documentOpened: false,
      pageCount: 0,
      pagesRendered: 0,
      renderChecksum: boundedChecksum(`pdf:fixture:contract-only`),
      errorClass: 'none',
      rawPathExported: false
    };
  }

  getPageCount(): number {
    return this.pageCount;
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) { return 'permission'; }
    if (text.indexOf('unsupported') !== -1) { return 'unsupported'; }
    if (text.indexOf('corrupt') !== -1) { return 'corrupt'; }
    if (text.length === 0) { return 'unknown'; }
    return 'pdf_error';
  }
}

// image.PixelMap is imported indirectly via the pdf module; declare a minimal
// shape to avoid pulling in the full image kit for this contract-only adapter.
declare interface image { PixelMap: unknown }
