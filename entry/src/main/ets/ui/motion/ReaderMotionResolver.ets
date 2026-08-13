// ReaderMotionResolver — Phase 2 Motion Runtime entry point.
// Pages/components declare a generated MotionPolicy-shaped intent;
// the resolver matches against the priority-sorted MotionPolicy table and returns the concrete motionId.
// The motionId is then handed to MotionSpecRegistry → MotionAdapter.
// Pages must NOT pick motionIds themselves.
import { MotionPolicy } from '../../contract/generated/MotionPolicyTable';
import { MotionPolicyTable } from '../../contract/generated/MotionPolicyTable';
import { MotionSpec } from '../../contract/generated/MotionSpecTable';
import { MotionSpecRegistry } from './MotionSpecRegistry';

export interface MotionRequest {
  fromRoute?: string;
  toRoute?: string;
  fromShell?: string;
  toShell?: string;
  operation?: string;        // enter | exit | push | pop | replace | tabSwitch | update | ...
  containerRole?: string;    // appShell | mainTabShell | readerShell | overlayHost | sessionCapsule | ...
  sourceRole?: string;       // firstOpen | viewMode | bookCover | actionButton | ...
  targetRole?: string;       // sheet | dialog | toast | dropdown | ...
  reducedMotion?: boolean;
}

export class ReaderMotionResolver {
  // Returns the generated MotionSpec selected by the highest-priority policy.
  // A policy that references an absent spec is contract drift and fails loudly;
  // it must never fall through to an unrelated hand-authored motion.
  static resolveSpec(req: MotionRequest): MotionSpec | undefined {
    const policies = MotionPolicyTable.POLICIES; // sorted priority desc at generation time
    for (let i = 0; i < policies.length; i++) {
      const p: MotionPolicy = policies[i];
      // Native resolution must not turn an unknown intent into an unrelated
      // interrupt animation. Only policies with explicit match dimensions may
      // participate; an unmatched request returns undefined to the caller.
      if (!ReaderMotionResolver.hasExplicitMatch(p)) continue;
      if (ReaderMotionResolver.matches(p, req)) {
        const spec = MotionSpecRegistry.byId(p.motionId);
        if (spec === undefined) {
          throw new Error(`Motion policy ${p.id} references missing generated spec ${p.motionId}`);
        }
        return spec;
      }
    }
    return undefined;
  }

  // Wire-name compatibility for existing callers.
  static resolve(req: MotionRequest): string | undefined {
    const spec = ReaderMotionResolver.resolveSpec(req);
    return spec === undefined ? undefined : spec.id;
  }

  // Convenience for legacy callers. The fallback itself must be generated;
  // unknown serial names are rejected instead of becoming a no-op catch-all.
  static resolveOr(req: MotionRequest, fallback: string): string {
    const spec = ReaderMotionResolver.resolveSpec(req);
    if (spec !== undefined) return spec.id;
    const fallbackSpec = MotionSpecRegistry.byId(fallback);
    if (fallbackSpec === undefined) {
      throw new Error(`Unknown generated fallback MotionSpec: ${fallback}`);
    }
    return fallbackSpec.id;
  }

  private static hasExplicitMatch(p: MotionPolicy): boolean {
    const m = p.match;
    return m.fromRoute !== undefined
      || m.toRoute !== undefined
      || m.fromShell !== undefined
      || m.toShell !== undefined
      || m.operation !== undefined
      || m.containerRole !== undefined
      || m.sourceRole !== undefined
      || m.targetRole !== undefined
      || m.reducedMotion !== undefined;
  }

  private static matches(p: MotionPolicy, req: MotionRequest): boolean {
    const m = p.match;
    if (m.fromRoute !== undefined && m.fromRoute !== req.fromRoute) return false;
    if (m.toRoute !== undefined && m.toRoute !== req.toRoute) return false;
    if (m.fromShell !== undefined && m.fromShell !== req.fromShell) return false;
    if (m.toShell !== undefined && m.toShell !== req.toShell) return false;
    if (m.operation !== undefined && m.operation !== req.operation) return false;
    if (m.containerRole !== undefined && m.containerRole !== req.containerRole) return false;
    if (m.sourceRole !== undefined) {
      if (req.sourceRole === undefined || m.sourceRole !== req.sourceRole) return false;
    }
    if (m.targetRole !== undefined) {
      if (req.targetRole === undefined || m.targetRole !== req.targetRole) return false;
    }
    if (m.reducedMotion !== undefined) {
      const reqRm = req.reducedMotion === true;
      if (m.reducedMotion !== reqRm) return false;
    }
    return true;
  }
}
