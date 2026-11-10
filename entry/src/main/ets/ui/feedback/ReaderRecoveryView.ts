/** Read-only recovery content rendered by the shared feedback surfaces. */
export interface ReaderRecoveryView {
  message: string;
  visible: boolean;
  canRetry: boolean;
  generation: number;
}
