/**
 * Per-route native measurements. One store replaces page-local height state and
 * rejects receipts from an older navigation/layout generation.
 */
export class ReaderMeasurementStore {
  private readonly values: Map<string, number> = new Map<string, number>();
  private readonly generations: Map<string, number> = new Map<string, number>();

  record(key: string, height: number, generation: number, epsilon: number = 0.01): boolean {
    if (key.length === 0 || !Number.isFinite(height) || height < 0 || !Number.isFinite(generation)) return false;
    const previousGeneration = this.generations.get(key);
    if (previousGeneration !== undefined && generation < previousGeneration) return false;
    const previous = this.values.get(key);
    const delta = Number.isFinite(epsilon) ? Math.abs(epsilon) : 0.01;
    if (previous !== undefined && previousGeneration === generation && Math.abs(previous - height) < delta) return false;
    this.values.set(key, height);
    this.generations.set(key, generation);
    return true;
  }

  read(key: string, fallback: number = 0): number {
    const value = this.values.get(key);
    return value === undefined ? fallback : value;
  }

  /** A receipt from a previous layout generation must not define the current one. */
  readForGeneration(key: string, generation: number, fallback: number = 0): number {
    if (!Number.isFinite(generation) || this.generations.get(key) !== generation) return fallback;
    return this.read(key, fallback);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  invalidate(key: string): void {
    this.values.delete(key);
    this.generations.delete(key);
  }

  clear(): void {
    this.values.clear();
    this.generations.clear();
  }
}
