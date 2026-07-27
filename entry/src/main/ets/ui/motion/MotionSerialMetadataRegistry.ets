// Runtime/diagnostic serial metadata derived from the generated 93-entry
// MotionSpecTable. No hand-written MotionId switch or default record is kept:
// adding/removing a canonical MotionSpec changes this registry automatically.
import { MotionSpec } from '../../contract/generated/MotionSpecTable';
import { MotionSpecRegistry } from './MotionSpecRegistry';

export interface MotionSerialMetadata {
  serialName: string;
  operation: string;
  containerRole: string;
  implementationKind: string;
  visualPattern: string;
  interruptPolicy: string;
  reducedMotionPolicy: string;
  durationMs: number;
}

export class MotionSerialMetadataRegistry {
  private static fromSpec(spec: MotionSpec): MotionSerialMetadata {
    return {
      serialName: spec.id,
      operation: spec.operation,
      containerRole: spec.containerRole,
      implementationKind: spec.implementationKind,
      visualPattern: spec.visualPattern,
      interruptPolicy: spec.interruptPolicy,
      reducedMotionPolicy: spec.reducedMotionPolicy,
      durationMs: spec.durationMs,
    };
  }

  static all(): MotionSerialMetadata[] {
    const metadata: MotionSerialMetadata[] = [];
    const specs = MotionSpecRegistry.all();
    for (let index = 0; index < specs.length; index++) {
      metadata.push(MotionSerialMetadataRegistry.fromSpec(specs[index]));
    }
    return metadata;
  }

  static bySerialName(serialName: string): MotionSerialMetadata | undefined {
    const spec = MotionSpecRegistry.byId(serialName);
    return spec === undefined ? undefined : MotionSerialMetadataRegistry.fromSpec(spec);
  }
}
