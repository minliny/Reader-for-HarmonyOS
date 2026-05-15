// EPUBParserContract — ArkTS port of Core EPUBParserContract.swift + EPUBModels.swift
// CONTRACT_ONLY — ZIP/XML parsing is adapter scope (HOS-8B)
import { LocalBook, LocalTOCItem } from '../models/LocalBook';

export interface EPUBMetadata {
  title: string;
  creator?: string;
  identifier?: string;
  language?: string;
  publisher?: string;
  date?: string;
  extraFields: Record<string, string>;
}

export interface EPUBNavPoint {
  label: string;
  src?: string;
  children: EPUBNavPoint[];
}

export interface EPUBParseResult {
  metadata: EPUBMetadata;
  navPoints: EPUBNavPoint[];
  coverData?: Uint8Array;
}

// Contract interface (adapter provides ZIP/XML parsing)
export interface EPUBParserContract {
  parse(data: Uint8Array): Promise<EPUBParseResult>;
}

// Mapping utilities (mirrors Core EPUBMapping)
export class EPUBMapping {
  static toLocalBook(metadata: EPUBMetadata): LocalBook {
    const extra: Record<string, Object> = {};
    if (metadata.identifier) { extra['epub:identifier'] = { 'value': metadata.identifier }; }
    if (metadata.language) { extra['epub:language'] = { 'value': metadata.language }; }
    if (metadata.publisher) { extra['epub:publisher'] = { 'value': metadata.publisher }; }
    if (metadata.date) { extra['epub:date'] = { 'value': metadata.date }; }
    const keys = Object.keys(metadata.extraFields);
    for (let i = 0; i < keys.length; i++) {
      extra[`epub:${keys[i]}`] = { 'value': metadata.extraFields[keys[i]] };
    }

    return {
      id: metadata.identifier ?? '',
      title: metadata.title,
      author: metadata.creator,
      filePath: '',
      fileFormat: 'epub',
      encoding: 'utf-8',
      addedAt: Date.now(),
      unknownFields: extra as Record<string, import('../models/JSONValue').JSONValue>
    };
  }

  static toTOCItems(navPoints: EPUBNavPoint[]): LocalTOCItem[] {
    return navPoints.map(nav => ({
      title: nav.label,
      level: 1,
      children: nav.children.length > 0 ? EPUBMapping.toTOCItems(nav.children) : undefined
    }));
  }
}
