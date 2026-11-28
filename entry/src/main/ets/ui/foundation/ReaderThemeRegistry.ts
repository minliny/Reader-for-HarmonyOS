// Generated from Reader-UI/theme/registry.json. Do not edit.
// SHA256 db347e4638524dbb3b7951e3e774048d6e7fc2792a4b98853707a96350a77e00
import { readerAppColor, type ReaderThemeScheme, type ReaderAppThemeMode, type ReaderAppColorRole } from './ReaderAppColors.ts';
export { readerAppColor, type ReaderThemeScheme, type ReaderAppThemeMode, type ReaderAppColorRole };
export type ReaderThemeId = "day" | "warm" | "night" | "warmNight" | "paper" | "green" | "paperNight" | "greenNight";
export interface ReaderThemeDefinition {
  id: ReaderThemeId; scheme: ReaderThemeScheme; order: number; displayName: string;
  paperStart: string; paperEnd: string; ink: string; chromeMeta: string;
  statusBackground: string; statusForeground: string; swatch: string; selection: string; paperBack: string; turnShadow: string;
  paperTexture: boolean; sourcePaperLighting: boolean;
}
export const READER_THEME_DEFINITIONS: ReaderThemeDefinition[] = [
  {
    "id": "day",
    "scheme": "day",
    "order": 0,
    "displayName": "日间",
    "paperStart": "#FFF7F3EA",
    "paperEnd": "#FFF7F3EA",
    "ink": "#FF2B241D",
    "chromeMeta": "#FF766C61",
    "statusBackground": "#FFF7F3EA",
    "statusForeground": "#FF2B241D",
    "swatch": "#FFFAF7F1",
    "selection": "#33594632",
    "paperBack": "#FFF7F3EA",
    "turnShadow": "#38000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  },
  {
    "id": "warm",
    "scheme": "day",
    "order": 1,
    "displayName": "暖白",
    "paperStart": "#FFF2E8D3",
    "paperEnd": "#FFF2E8D3",
    "ink": "#FF2C241D",
    "chromeMeta": "#FF766C61",
    "statusBackground": "#FFF2E8D3",
    "statusForeground": "#FF2C241D",
    "swatch": "#FFF5E7CE",
    "selection": "#33594632",
    "paperBack": "#FFF2E8D3",
    "turnShadow": "#38000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  },
  {
    "id": "night",
    "scheme": "night",
    "order": 2,
    "displayName": "夜间",
    "paperStart": "#FF21221F",
    "paperEnd": "#FF21221F",
    "ink": "#FFE4DDD0",
    "chromeMeta": "#FF9D968B",
    "statusBackground": "#FF21221F",
    "statusForeground": "#FFE4DDD0",
    "swatch": "#FF201F1C",
    "selection": "#33594632",
    "paperBack": "#FF21221F",
    "turnShadow": "#22000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  },
  {
    "id": "warmNight",
    "scheme": "night",
    "order": 3,
    "displayName": "暖夜",
    "paperStart": "#FF31271D",
    "paperEnd": "#FF31271D",
    "ink": "#FFE7D8C8",
    "chromeMeta": "#FFB3A18F",
    "statusBackground": "#FF31271D",
    "statusForeground": "#FFE7D8C8",
    "swatch": "#FF2A231B",
    "selection": "#33594632",
    "paperBack": "#FF31271D",
    "turnShadow": "#22000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  },
  {
    "id": "paper",
    "scheme": "day",
    "order": 4,
    "displayName": "纸纹",
    "paperStart": "#FFEDE2CB",
    "paperEnd": "#FFEDE2CB",
    "ink": "#FF2B241D",
    "chromeMeta": "#FF766C61",
    "statusBackground": "#FFEDE2CB",
    "statusForeground": "#FF2B241D",
    "swatch": "#FFEAE0CA",
    "selection": "#33594632",
    "paperBack": "#FFEDE2CB",
    "turnShadow": "#38000000",
    "paperTexture": true,
    "sourcePaperLighting": true
  },
  {
    "id": "green",
    "scheme": "day",
    "order": 5,
    "displayName": "青叶",
    "paperStart": "#FFE3EBDD",
    "paperEnd": "#FFE3EBDD",
    "ink": "#FF263423",
    "chromeMeta": "#FF63755F",
    "statusBackground": "#FFE3EBDD",
    "statusForeground": "#FF263423",
    "swatch": "#FFDCE7D6",
    "selection": "#33594632",
    "paperBack": "#FFE3EBDD",
    "turnShadow": "#38000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  },
  {
    "id": "paperNight",
    "scheme": "night",
    "order": 6,
    "displayName": "夜纹",
    "paperStart": "#FF202630",
    "paperEnd": "#FF202630",
    "ink": "#FFE2DDD5",
    "chromeMeta": "#FF9BA5B2",
    "statusBackground": "#FF202630",
    "statusForeground": "#FFE2DDD5",
    "swatch": "#FF22262E",
    "selection": "#33594632",
    "paperBack": "#FF202630",
    "turnShadow": "#22000000",
    "paperTexture": true,
    "sourcePaperLighting": false
  },
  {
    "id": "greenNight",
    "scheme": "night",
    "order": 7,
    "displayName": "林夜",
    "paperStart": "#FF1D2D23",
    "paperEnd": "#FF1D2D23",
    "ink": "#FFD8E2D2",
    "chromeMeta": "#FF97AA9A",
    "statusBackground": "#FF1D2D23",
    "statusForeground": "#FFD8E2D2",
    "swatch": "#FF1F2C22",
    "selection": "#33594632",
    "paperBack": "#FF1D2D23",
    "turnShadow": "#22000000",
    "paperTexture": false,
    "sourcePaperLighting": false
  }
];
export function findReaderTheme(id: string): ReaderThemeDefinition | undefined {
  return READER_THEME_DEFINITIONS.find((theme: ReaderThemeDefinition): boolean => theme.id === id);
}
export function readerThemeDefinition(id: string): ReaderThemeDefinition {
  return findReaderTheme(id) ?? READER_THEME_DEFINITIONS[0];
}
