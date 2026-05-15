// Mirrors ReaderCoreModels/ReadingFlowModels.swift
import { JSONValue } from './JSONValue';

export enum ContentType {
  text = 'text',
  html = 'html',
  image = 'image',
  video = 'video'
}

export enum VIPStatus {
  free = 'free',
  vip = 'vip',
  paywall = 'paywall',
  unknown = 'unknown'
}

export interface TOCItem {
  chapterTitle: string;
  chapterURL: string;
  chapterIndex: number;
  isVip: boolean;
  unknownFields: Record<string, JSONValue>;
}

export interface ContentPage {
  title: string;
  content: string;
  chapterURL: string;
  nextChapterURL?: string;
  contentType?: ContentType;
  vipStatus?: VIPStatus;
  payAction?: string;
  unknownFields: Record<string, JSONValue>;
}
