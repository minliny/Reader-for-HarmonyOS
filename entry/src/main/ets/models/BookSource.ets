// Mirrors ReaderCoreModels/BookSource.swift
import { JSONValue } from './JSONValue';

export interface SearchRule {
  name: string;
  searchUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  resultRule: string;
  bookList: string;
  bookName: string;
  bookAuthor: string;
  bookCover?: string;
  bookIntro?: string;
  bookDetail?: string;
  bookWordCount?: string;
  bookLastChapter?: string;
  bookUpdateTime?: string;
}

export interface BookInfoRule {
  name: string;
  init: string;
  bookName: string;
  bookAuthor?: string;
  bookCover?: string;
  bookIntro?: string;
  bookCategory?: string;
  bookWordCount?: string;
  bookLastChapter?: string;
  bookUpdateTime?: string;
  toc: string;
}

export interface TocRule {
  name: string;
  chapterList: string;
  chapterName: string;
  chapterUrl: string;
  isVolume: boolean;
  isVip?: string;
  isPay?: string;
  updateTime?: string;
  nextTocUrl?: string;
}

export interface ContentRule {
  name: string;
  content: string;
  nextContentUrl?: string;
  webJs?: string;
  imageStyle?: string;
  imageDecode?: string;
  payAction?: string;
  title?: string;
  sourceRegex?: string;
  replaceRegex?: string;
}

export interface LoginDescriptor {
  loginUrl: string;
  loginCheckJs: string;
  loginUi: string;
}

export interface BookSource {
  bookSourceName: string;
  bookSourceGroup?: string;
  bookSourceUrl: string;
  searchUrl?: string;
  searchRule?: SearchRule;
  bookInfoRule?: BookInfoRule;
  tocRule?: TocRule;
  contentRule?: ContentRule;
  exploreRule?: string;
  loginDescriptor?: LoginDescriptor;
  header?: string;
  enabled: boolean;
  weight: number;
  unknownFields: Record<string, JSONValue>;
}
