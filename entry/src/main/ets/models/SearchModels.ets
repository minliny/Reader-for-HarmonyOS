// Mirrors ReaderCoreModels/ReadingFlowModels.swift
import { JSONValue } from './JSONValue';

export interface SearchQuery {
  keyword: string;
  page: number;
  pageSize?: number;
}

export interface SearchResultItem {
  title: string;
  detailURL: string;
  author?: string;
  coverURL?: string;
  intro?: string;
  nextPageUrl?: string;
  unknownFields: Record<string, JSONValue>;
}

export interface BookInfoItem {
  title: string;
  author?: string;
  coverURL?: string;
  intro?: string;
  category?: string;
  wordCount?: number;
  lastChapter?: string;
  updateTime?: string;
  unknownFields: Record<string, JSONValue>;
}

export interface ExploreResultItem {
  title: string;
  author?: string;
  detailURL: string;
  coverURL?: string;
  intro?: string;
  unknownFields: Record<string, JSONValue>;
}
