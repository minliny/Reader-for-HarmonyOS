// ReaderMotionResolver — Phase 2 Motion Runtime entry point.
// Pages/components declare an intent {operation, containerRole, sourceRole?, targetRole?, reducedMotion?};
// the resolver matches against the priority-sorted MotionPolicy table and returns the concrete motionId.
// The motionId is then handed to MotionSpecRegistry → MotionAdapter.
// Pages must NOT pick motionIds themselves.
import { MotionPolicy } from '../../contract/generated/MotionPolicyTable';
import { MotionPolicyTable } from '../../contract/generated/MotionPolicyTable';

export interface MotionRequest {
  operation: string;        // enter | exit | push | pop | replace | tabSwitch | update | ...
  containerRole: string;    // appShell | mainTabShell | readerShell | overlayHost | sessionCapsule | ...
  sourceRole?: string;       // firstOpen | viewMode | bookCover | actionButton | ...
  targetRole?: string;       // sheet | dialog | toast | dropdown | ...
  reducedMotion?: boolean;
}

export class ReaderMotionResolver {
  // Returns the highest-priority matching motionId, or undefined if no policy matches.
  static resolve(req: MotionRequest): string | undefined {
    const policies = MotionPolicyTable.POLICIES; // sorted priority desc at generation time
    for (let i = 0; i < policies.length; i++) {
      const p: MotionPolicy = policies[i];
      if (ReaderMotionResolver.matches(p, req)) {
        return p.motionId;
      }
    }
    return undefined;
  }

  // Convenience: resolve and fall back to a default motionId when nothing matches.
  static resolveOr(req: MotionRequest, fallback: string): string {
    const id = ReaderMotionResolver.resolve(req);
    return id !== undefined ? id : fallback;
  }

  private static matches(p: MotionPolicy, req: MotionRequest): boolean {
    const m = p.match;
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
