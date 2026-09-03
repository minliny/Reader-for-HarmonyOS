import { commonEventManager } from '@kit.BasicServicesKit';
import { inputConsumer, KeyCode, type KeyEvent } from '@kit.InputKit';
import type { ReaderPageTurnDirection } from '../features/reading/ReaderPageGestureState';

const KEY_PRESSED_ACTION = 1;

/**
 * Reader-scoped Host bridge for physical keys and system lifecycle events.
 * UI state decides whether a handler exists; this class alone owns HarmonyOS
 * subscriptions and always releases them with the mounted reading session.
 */
export class ReaderReadingSystemEventHost {
  private volumeHandler: ((direction: ReaderPageTurnDirection) => void) | undefined = undefined;
  private screenOffHandler: (() => void) | undefined = undefined;
  private volumeRegistered: boolean = false;
  private screenOffSubscriber: commonEventManager.CommonEventSubscriber | undefined = undefined;
  private screenOffSubscriptionGeneration: number = 0;
  private disposed: boolean = false;

  private readonly volumeUpListener = (_event: KeyEvent): void => {
    this.volumeHandler?.('previous');
  };

  private readonly volumeDownListener = (_event: KeyEvent): void => {
    this.volumeHandler?.('next');
  };

  setVolumeKeyHandler(handler: ((direction: ReaderPageTurnDirection) => void) | undefined): void {
    if (this.disposed) {
      return;
    }
    this.unregisterVolumeKeys();
    this.volumeHandler = handler;
    if (handler === undefined) {
      return;
    }
    try {
      inputConsumer.on('keyPressed', {
        key: KeyCode.KEYCODE_VOLUME_UP,
        action: KEY_PRESSED_ACTION,
        isRepeat: false,
      }, this.volumeUpListener);
      inputConsumer.on('keyPressed', {
        key: KeyCode.KEYCODE_VOLUME_DOWN,
        action: KEY_PRESSED_ACTION,
        isRepeat: false,
      }, this.volumeDownListener);
      this.volumeRegistered = true;
    } catch (_error) {
      this.unregisterVolumeKeys();
    }
  }

  setScreenOffHandler(handler: (() => void) | undefined): void {
    if (this.disposed) {
      return;
    }
    this.screenOffHandler = handler;
    if (handler !== undefined) {
      void this.ensureScreenOffSubscription();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.volumeHandler = undefined;
    this.screenOffHandler = undefined;
    this.unregisterVolumeKeys();
    this.screenOffSubscriptionGeneration += 1;
    const subscriber = this.screenOffSubscriber;
    this.screenOffSubscriber = undefined;
    if (subscriber !== undefined) {
      try {
        commonEventManager.unsubscribe(subscriber);
      } catch (_error) {
        // A destroyed Ability may have already released the subscriber.
      }
    }
  }

  private unregisterVolumeKeys(): void {
    if (!this.volumeRegistered) {
      return;
    }
    try {
      inputConsumer.off('keyPressed', this.volumeUpListener);
    } catch (_error) {
    }
    try {
      inputConsumer.off('keyPressed', this.volumeDownListener);
    } catch (_error) {
    }
    this.volumeRegistered = false;
  }

  private async ensureScreenOffSubscription(): Promise<void> {
    if (this.disposed || this.screenOffSubscriber !== undefined) {
      return;
    }
    const generation = this.screenOffSubscriptionGeneration + 1;
    this.screenOffSubscriptionGeneration = generation;
    try {
      const subscriber = await commonEventManager.createSubscriber({
        events: [commonEventManager.Support.COMMON_EVENT_SCREEN_OFF],
      });
      if (this.disposed || generation !== this.screenOffSubscriptionGeneration) {
        commonEventManager.unsubscribe(subscriber);
        return;
      }
      await commonEventManager.subscribeToEvent(
        subscriber,
        (_data: commonEventManager.CommonEventData): void => this.screenOffHandler?.(),
      );
      if (this.disposed || generation !== this.screenOffSubscriptionGeneration) {
        commonEventManager.unsubscribe(subscriber);
        return;
      }
      this.screenOffSubscriber = subscriber;
    } catch (_error) {
      // Unsupported devices keep the ordinary system behavior. A later
      // mounted reader will attempt a fresh subscription.
    }
  }
}
