// MotionSpecRegistry — motionId → MotionSpec.
// Thin wrapper over the generated MotionSpecTable so non-generated code never
// imports the generated module directly (keeps the contract boundary explicit).
import { MotionSpec } from '../../contract/generated/MotionSpecTable';
import { MotionSpecTable } from '../../contract/generated/MotionSpecTable';

export class MotionSpecRegistry {
  static byId(id: string): MotionSpec | undefined {
    return MotionSpecTable.byId(id);
  }

  static has(id: string): boolean {
    return MotionSpecTable.byId(id) !== undefined;
  }

  static all(): MotionSpec[] {
    return MotionSpecTable.SPECS;
  }
}
