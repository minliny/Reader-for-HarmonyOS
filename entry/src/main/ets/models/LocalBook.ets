// Mirrors ReaderCoreModels/LocalBookModels.swift
import { JSONValue } from './JSONValue';

export enum LocalBookFormat {
  txt = 'txt',
  epub = 'epub',
  pdf = 'pdf',
  html = 'html',
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
