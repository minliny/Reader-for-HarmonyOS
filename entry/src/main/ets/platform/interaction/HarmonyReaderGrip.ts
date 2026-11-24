import lazy { motion } from '@kit.MultimodalAwarenessKit';
import { readerHarmonyCapabilities } from '../../app/HarmonyCapabilityProbe';
import { readerHoldingHand, type ReaderHoldingHand } from '../../features/reading/ui/ReaderControlPlacement';

/** Registration verifies device support and the system-granted permission. */
export function subscribeReaderHoldingHand(publish: (hand: ReaderHoldingHand) => void): (() => void) | undefined {
  if (!readerHarmonyCapabilities().grip) return undefined;
  let active = true;
  const onChange = (status: motion.HoldingHandStatus): void => {
    if (active) publish(readerHoldingHand(status));
  };
  try {
    motion.on('holdingHandChanged', onChange);
  } catch (_) {
    active = false;
    return undefined;
  }
  return (): void => {
    active = false;
    try { motion.off('holdingHandChanged', onChange); } catch (_) { /* The callback is retired locally. */ }
  };
}
