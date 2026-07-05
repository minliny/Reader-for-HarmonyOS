import { getToken, Token, TokenCategory, tokens } from '../../contract';
import {
  ReaderColorToken,
  ReaderMotionDurationToken,
  ReaderRadiusToken,
  ReaderSizeToken,
  ReaderSpacingToken,
  ReaderTypeToken,
  ReaderZIndexToken
} from '../ReaderToken';

export interface ArkTokenValue {
  name: string;
  category: TokenCategory;
  value: string;
  arkuiValue: string;
}

export class TokenAdapter {
  static all(): ArkTokenValue[] {
    return tokens.map((token: Token): ArkTokenValue => TokenAdapter.toArkToken(token));
  }

  static byName(name: string): ArkTokenValue | undefined {
    const token = getToken(name);
    if (!token) {
      return undefined;
    }
    return TokenAdapter.toArkToken(token);
  }

  static byCategory(category: TokenCategory): ArkTokenValue[] {
    return tokens
      .filter((token: Token): boolean => token.category === category)
      .map((token: Token): ArkTokenValue => TokenAdapter.toArkToken(token));
  }

  static color(name: string, darkMode: boolean = false): string {
    if (darkMode) {
      return TokenAdapter.darkColor(name);
    }
    const token = TokenAdapter.byName(name);
    return token ? token.arkuiValue : ReaderColorToken.paper;
  }

  static tabBarHeight(): number {
    return ReaderSizeToken.bottomBarHeight;
  }

  static mainNavZIndex(): number {
    return ReaderZIndexToken.mainNav;
  }

  static screenPadding(): number {
    return ReaderSpacingToken.screenPadding;
  }

  static cardRadius(): number {
    return ReaderRadiusToken.card;
  }

  static appTitleSize(): number {
    return ReaderTypeToken.appTitleSize;
  }

  static motionDuration(name: string, reducedMotion: boolean): number {
    if (reducedMotion) {
      return 0;
    }
    const token = getToken(name);
    if (token && token.category === 'motion-duration') {
      return TokenAdapter.parseDurationMs(token.value, ReaderMotionDurationToken.readerBase);
    }
    return ReaderMotionDurationToken.readerBase;
  }

  static coverageCount(): number {
    return tokens.filter((token: Token): boolean => token.deprecated !== true).length;
  }

  static generatedToken(name: string): Token | undefined {
    return getToken(name);
  }

  private static toArkToken(token: Token): ArkTokenValue {
    return {
      name: token.name,
      category: token.category,
      value: token.value,
      arkuiValue: token.platforms?.arkts ?? token.value
    };
  }

  private static darkColor(name: string): string {
    if (name === '--reader-ds-color-paper' || name === '--reader-ds-color-paper-bright') {
      return '#FF191714';
    }
    if (name === '--reader-ds-color-ink' || name === '--reader-ds-color-control-ink') {
      return '#FFEDE5DC';
    }
    if (name === '--reader-ds-color-bottom-bar-bg' || name === '--reader-ds-color-floating-control-bg') {
      return '#FF24201D';
    }
    return TokenAdapter.byName(name)?.arkuiValue ?? ReaderColorToken.ink;
  }

  private static parseDurationMs(value: string, fallback: number): number {
    const normalized = value.replace('ms', '');
    const parsed = Number(normalized);
    return parsed >= 0 ? parsed : fallback;
  }
}
