// ReaderDirectoryToTtsMotionCoordinator owns only the transient Phone visual
// handoff for the one Figma-reviewed actor pair. Durable navigation and TTS
// business state remain owned by ReaderUiStore / ReaderReducer.
export class ReaderDirectoryToTtsMotionCoordinator {
  static readonly K_ACTIVE: string = 'reader.directoryToTtsMotion.active';
  static readonly K_SEQUENCE: string = 'reader.directoryToTtsMotion.sequence';
  static readonly DIRECTORY_ROUTE: string = 'reader-directory-overlay-v2';
  static readonly TTS_ROUTE: string = 'reader-tts-overlay-v2';
  static readonly TTS_MODULE: string = 'tts';

  private static nextSequenceValue: number = 0;

  // The Figma reference has exactly one direct actor pair: Phone Directory →
  // TTS. Do not turn its generic generated MotionSpec into a transition for
  // another source, target, wide layout, or reduced-motion session.
  static arm(fromDisplayedRoute: string, targetModule: string, isWide: boolean,
    reducedMotion: boolean): boolean {
    if (fromDisplayedRoute !== ReaderDirectoryToTtsMotionCoordinator.DIRECTORY_ROUTE ||
      targetModule !== ReaderDirectoryToTtsMotionCoordinator.TTS_MODULE ||
      isWide || reducedMotion) {
      return false;
    }
    AppStorage.setOrCreate<number>(
      ReaderDirectoryToTtsMotionCoordinator.K_SEQUENCE,
      ReaderDirectoryToTtsMotionCoordinator.nextSequence(),
    );
    AppStorage.setOrCreate<boolean>(ReaderDirectoryToTtsMotionCoordinator.K_ACTIVE, true);
    return true;
  }

  static active(): boolean {
    return AppStorage.get<boolean>(ReaderDirectoryToTtsMotionCoordinator.K_ACTIVE) === true;
  }

  static sequence(): number {
    return AppStorage.get<number>(ReaderDirectoryToTtsMotionCoordinator.K_SEQUENCE) ?? 0;
  }

  static finish(sequence: number): void {
    if (!ReaderDirectoryToTtsMotionCoordinator.active() ||
      ReaderDirectoryToTtsMotionCoordinator.sequence() !== sequence) {
      return;
    }
    AppStorage.setOrCreate<boolean>(ReaderDirectoryToTtsMotionCoordinator.K_ACTIVE, false);
  }

  static cancel(): void {
    if (!ReaderDirectoryToTtsMotionCoordinator.active()) return;
    AppStorage.setOrCreate<number>(
      ReaderDirectoryToTtsMotionCoordinator.K_SEQUENCE,
      ReaderDirectoryToTtsMotionCoordinator.nextSequence(),
    );
    AppStorage.setOrCreate<boolean>(ReaderDirectoryToTtsMotionCoordinator.K_ACTIVE, false);
  }

  static cancelIfTargetRouteDiffers(routeId: string): void {
    if (ReaderDirectoryToTtsMotionCoordinator.active() &&
      routeId !== ReaderDirectoryToTtsMotionCoordinator.TTS_ROUTE) {
      ReaderDirectoryToTtsMotionCoordinator.cancel();
    }
  }

  private static nextSequence(): number {
    ReaderDirectoryToTtsMotionCoordinator.nextSequenceValue += 1;
    if (ReaderDirectoryToTtsMotionCoordinator.nextSequenceValue > 2147483646) {
      ReaderDirectoryToTtsMotionCoordinator.nextSequenceValue = 1;
    }
    return ReaderDirectoryToTtsMotionCoordinator.nextSequenceValue;
  }
}
