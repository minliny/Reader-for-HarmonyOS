import lazy { motion } from '@kit.MultimodalAwarenessKit';
import { readerHarmonyCapabilities } from '../../app/HarmonyCapabilityProbe';
import type { ReaderHoldingHand } from './ReaderHoldingHand';

const retiringListeners: Set<(status: motion.HoldingHandStatus) => void> =
  new Set<(status: motion.HoldingHandStatus) => void>();

function readerHoldingHand(status: motion.HoldingHandStatus): ReaderHoldingHand {
  if (status === motion.HoldingHandStatus.LEFT_HAND_HELD) return 'left';
  if (status === motion.HoldingHandStatus.RIGHT_HAND_HELD) return 'right';
  return undefined;
}

function removeHoldingHandListener(listener: (status: motion.HoldingHandStatus) => void): boolean {
  try {
    motion.off('holdingHandChanged', listener);
    retiringListeners.delete(listener);
    return true;
  } catch (_) {
    retiringListeners.add(listener);
    return false;
  }
}

/** Registration verifies device support and the system-granted permission. */
export function subscribeReaderHoldingHand(publish: (hand: ReaderHoldingHand) => void): (() => void) | undefined {
  if (!readerHarmonyCapabilities().grip) return undefined;
  for (const retiring of retiringListeners) {
    if (!removeHoldingHandListener(retiring)) return undefined;
  }
  let current: ((hand: ReaderHoldingHand) => void) | undefined = publish;
  const onChange = (status: motion.HoldingHandStatus): void => {
    current?.(readerHoldingHand(status));
  };
  try {
    motion.on('holdingHandChanged', onChange);
  } catch (_) {
    current = undefined;
    return undefined;
  }
  return (): void => {
    if (current === undefined) return;
    current = undefined;
    removeHoldingHandListener(onChange);
  };
}
