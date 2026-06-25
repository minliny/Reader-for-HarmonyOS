// EPUBParserContract — ArkTS port of Core EPUBParserContract.swift + EPUBModels.swift
// CONTRACT_ONLY — ZIP/XML parsing is adapter scope (HOS-8B)
import { LocalBook, LocalBookFormat, LocalTOCItem } from '../models/LocalBook';

import { JSONValue } from '../models/JSONValue';

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

interface EPUBExtraValue {
  value: string;
}

// Mapping utilities (mirrors Core EPUBMapping)
export class EPUBMapping {
  private static wrap(value: string): EPUBExtraValue {
    return { value: value };
  }

  static toLocalBook(metadata: EPUBMetadata): LocalBook {
    const extra: Record<string, Object> = {};
    if (metadata.identifier) { extra['epub:identifier'] = EPUBMapping.wrap(metadata.identifier); }
    if (metadata.language) { extra['epub:language'] = EPUBMapping.wrap(metadata.language); }
    if (metadata.publisher) { extra['epub:publisher'] = EPUBMapping.wrap(metadata.publisher); }
    if (metadata.date) { extra['epub:date'] = EPUBMapping.wrap(metadata.date); }
    const keys = Object.keys(metadata.extraFields);
    for (let i = 0; i < keys.length; i++) {
      extra[`epub:${keys[i]}`] = EPUBMapping.wrap(metadata.extraFields[keys[i]]);
    }

    return {
      id: metadata.identifier ?? '',
      title: metadata.title,
      author: metadata.creator,
      filePath: '',
      fileFormat: LocalBookFormat.epub,
      encoding: 'utf-8',
      addedAt: Date.now(),
      unknownFields: extra as Record<string, JSONValue>
    };
  }

  static toTOCItems(navPoints: EPUBNavPoint[]): LocalTOCItem[] {
    return navPoints.map((nav: EPUBNavPoint): LocalTOCItem => ({
      title: nav.label,
      level: 1,
      children: nav.children.length > 0 ? EPUBMapping.toTOCItems(nav.children) : undefined
    }));
  }
}
