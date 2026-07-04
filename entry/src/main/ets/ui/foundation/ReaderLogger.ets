// Reader for HarmonyOS - M8 跨层基础设施 - ReaderLogger.ets
import hilog from '@ohos.hilog';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class ReaderLogger {
  private static readonly DOMAIN = 0x0001;
  private static readonly TAG = 'ReaderApp';

  static d(tag: string, message: string, ...args: any[]): void {
    try {
      hilog.debug(ReaderLogger.DOMAIN, `${ReaderLogger.TAG}/${tag}`, message, ...args);
    } catch (e) {
      // hilog 不可用时降级到 console
      console.debug(`[${tag}] ${message}`);
    }
  }

  static i(tag: string, message: string, ...args: any[]): void {
    try {
      hilog.info(ReaderLogger.DOMAIN, `${ReaderLogger.TAG}/${tag}`, message, ...args);
    } catch (e) {
      console.info(`[${tag}] ${message}`);
    }
  }

  static w(tag: string, message: string, ...args: any[]): void {
    try {
      hilog.warn(ReaderLogger.DOMAIN, `${ReaderLogger.TAG}/${tag}`, message, ...args);
    } catch (e) {
      console.warn(`[${tag}] ${message}`);
    }
  }

  static e(tag: string, message: string, error?: Error): void {
    try {
      const errStr = error ? `: ${error.message}\n${error.stack || ''}` : '';
      hilog.error(ReaderLogger.DOMAIN, `${ReaderLogger.TAG}/${tag}`, `${message}${errStr}`);
    } catch (e) {
      console.error(`[${tag}] ${message}`, error);
    }
  }
}
