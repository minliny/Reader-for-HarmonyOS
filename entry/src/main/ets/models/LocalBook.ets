// Mirrors ReaderCoreModels/LocalBookModels.swift
import { JSONValue } from './JSONValue';

export enum LocalBookFormat {
  txt = 'txt',
  epub = 'epub',
  pdf = 'pdf',
  html = 'html',
  cbz = 'cbz',
  unknown = 'unknown'
}

export enum SplitPattern {
  regex = 'regex',
  size = 'size',
  marker = 'marker',
  auto = 'auto'
}

export interface ChapterSplitPolicy {
  pattern: SplitPattern;
  regex?: string;
  sizeBytes?: number;
  marker?: string;
}

export interface LocalBook {
  id: string;
  title: string;
  author?: string;
  coverPath?: string;
  filePath: string;
  fileFormat: LocalBookFormat;
  fileSize?: number;
  encoding?: string;
  addedAt: number;  // Date.getTime()
  lastOpenedAt?: number;
  unknownFields: Record<string, JSONValue>;
}

export interface LocalTOCItem {
  title: string;
  level: number;
  byteOffset?: number;
  children?: LocalTOCItem[];
}

export interface CoverMetadata {
  path: string;
  width?: number;
  height?: number;
  format?: string;
}

// Import models (mirrors Core ImportProtocols.swift)
export interface LocalBookImportRequest {
  sourcePath: string;
  format: LocalBookFormat;
  encoding?: string;
  splitPolicy: ChapterSplitPolicy;
  metadataOverrides: Record<string, string>;
}

export interface LocalBookImportResult {
  book: LocalBook;
  toc: LocalTOCItem[];
  cover?: CoverMetadata;
  warnings: LocalBookImportWarning[];
}

export interface LocalBookImportWarning {
  code: string;
  message: string;
  context?: Record<string, string>;
}
