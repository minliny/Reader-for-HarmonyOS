export class HttpActiveRequests<T> {
  private readonly byId = new Map<number, Set<T>>();

  track(id: number, operation: T): void {
    let active = this.byId.get(id);
    if (active === undefined) {
      active = new Set<T>();
      this.byId.set(id, active);
    }
    active.add(operation);
  }

  release(id: number, operation: T): void {
    const active = this.byId.get(id);
    if (active === undefined) return;
    active.delete(operation);
    if (active.size === 0) this.byId.delete(id);
  }

  forEach(id: number, visit: (operation: T) => void): void {
    this.byId.get(id)?.forEach(visit);
  }
}

interface HttpDnsPin {
  adding: Promise<void>;
  removing?: Promise<void>;
}

/** Owns the actual native mutations separately from deadline-limited callers. */
export class HttpDnsPinOwnership {
  private readonly byHost = new Map<string, HttpDnsPin>();

  owns(host: string): boolean { return this.byHost.has(host); }

  add(host: string, dispatch: () => Promise<void>): Promise<void> {
    if (this.byHost.has(host)) return Promise.reject(new Error('HTTP DNS pin is still owned'));
    const adding = Promise.resolve().then(dispatch);
    this.byHost.set(host, { adding });
    return adding;
  }

  clear(host: string, dispatch: () => Promise<void>): Promise<void> {
    const pin = this.byHost.get(host);
    if (pin === undefined) return Promise.resolve();
    if (pin.removing !== undefined) return pin.removing;
    // An add that settles after its caller timed out may have installed a rule.
    // Dispatch removal only after that original add is no longer pending.
    const removing = pin.adding.then(dispatch, dispatch).then((): void => {
      if (this.byHost.get(host) === pin) this.byHost.delete(host);
    }, (error: Error): never => {
      pin.removing = undefined;
      throw error;
    });
    pin.removing = removing;
    return removing;
  }
}

export function waitForHttpDnsMutation(operation: Promise<void>, timeoutMs: number, failure: () => Error): Promise<void> {
  let timer: number | undefined;
  const expiry = new Promise<void>((_resolve, reject): void => {
    timer = setTimeout((): void => reject(failure()), timeoutMs);
  });
  return Promise.race([operation, expiry]).finally((): void => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export interface HttpDnsAdmission {
  readonly route: 'direct' | 'systemProxy' | 'systemSynthetic';
  readonly addresses: string[];
  readonly directAdmissionScope?: string;
}

export interface HttpDnsHop<Target, Result> {
  assertCurrent: () => void;
  admit: () => Promise<Target>;
  send: (target: Target) => Promise<Result>;
}

export interface HttpDnsCohortPort<Target> {
  recover: (host: string) => Promise<void>;
  install: (host: string, target: Target) => Promise<void>;
  release: (host: string) => Promise<void>;
}

interface HttpDnsCohortMember<Target, Result> {
  hop: HttpDnsHop<Target, Result>;
  resolve: (result: Result) => void;
  reject: (error: unknown) => void;
}

interface HttpDnsCohortLane<Target, Result> {
  tail: Promise<void>;
  collecting?: HttpDnsCohortMember<Target, Result>[];
}

const MAX_DNS_COHORT_HOPS = 8;
const DNS_CLEAN_PROOF_WINDOW_MS = 100;

function sameDirectPin(left: HttpDnsAdmission, right: HttpDnsAdmission): boolean {
  return left.route === 'direct' && right.route === 'direct' && left.directAdmissionScope !== undefined &&
    left.directAdmissionScope === right.directAdmissionScope && left.addresses.length === right.addresses.length &&
    left.addresses.every((address: string, index: number): boolean => address === right.addresses[index]);
}

/** Only a sealed cohort may share a pin. Later work has to wait for a clean resolver again. */
export class HttpDnsHopQueue<Target extends HttpDnsAdmission, Result> {
  private readonly lanes = new Map<string, HttpDnsCohortLane<Target, Result>>();
  private readonly port: HttpDnsCohortPort<Target>;

  constructor(port: HttpDnsCohortPort<Target>) {
    this.port = port;
  }

  enqueue(host: string, hop: HttpDnsHop<Target, Result>): Promise<Result> {
    let lane = this.lanes.get(host);
    if (lane === undefined) {
      lane = { tail: Promise.resolve() };
      this.lanes.set(host, lane);
    }
    const owned = lane;
    let members = owned.collecting;
    if (members === undefined) {
      const cohort: HttpDnsCohortMember<Target, Result>[] = [];
      owned.collecting = cohort;
      members = cohort;
      setTimeout((): void => this.seal(host, owned, cohort), 0);
    }
    const cohort = members;
    return new Promise<Result>((resolve, reject): void => {
      cohort.push({ hop, resolve, reject });
      if (cohort.length >= MAX_DNS_COHORT_HOPS) this.seal(host, owned, cohort);
    });
  }

  private seal(host: string, lane: HttpDnsCohortLane<Target, Result>,
    members: HttpDnsCohortMember<Target, Result>[]): void {
    if (lane.collecting !== members) return;
    lane.collecting = undefined;
    const tail = lane.tail.then((): Promise<void> => this.runCohort(host, members)).catch((error: unknown): void => {
      for (const member of members) member.reject(error);
    });
    lane.tail = tail;
    void tail.then((): void => {
      if (lane.tail === tail && lane.collecting === undefined) this.lanes.delete(host);
    });
  }

  private async runCohort(host: string, members: HttpDnsCohortMember<Target, Result>[]): Promise<void> {
    if (members.length === 1) {
      await this.runSolo(host, members[0]);
      return;
    }
    // Process-wide rules affect the SDK's ordinary DNS lookups. No trial may
    // begin until the preceding group received a real native removal ACK.
    await this.port.recover(host);
    const proofs = await this.readCleanProofs(members);
    const first = proofs.findIndex((proof: Target | null | undefined): boolean => proof !== undefined && proof !== null);
    if (first >= 0) {
      const target = proofs[first]!;
      const shared: HttpDnsCohortMember<Target, Result>[] = [];
      for (let index = 0; index < proofs.length; index += 1) {
        const proof = proofs[index];
        if (proof === undefined || proof === null) continue;
        if (index === first || sameDirectPin(target, proof)) {
          shared.push(members[index]);
          proofs[index] = null;
        }
      }
      await this.sendAdmitted(host, shared, target);
    }
    // Unmatched or late read-only trials cannot lend authority after a pin.
    // Complete each of those requests with an independent clean lookup.
    for (let index = 0; index < members.length; index += 1) {
      if (proofs[index] !== null) await this.runSolo(host, members[index]);
    }
  }

  private async readCleanProofs(members: HttpDnsCohortMember<Target, Result>[]): Promise<(Target | null | undefined)[]> {
    const proofs = new Array<Target | null | undefined>(members.length).fill(undefined);
    let open = true;
    let timer: number | undefined;
    const reads = members.map(async (member: HttpDnsCohortMember<Target, Result>, index: number): Promise<void> => {
      try {
        member.hop.assertCurrent();
        const proof = await member.hop.admit();
        member.hop.assertCurrent();
        if (open) proofs[index] = proof;
      } catch (error) {
        if (open) {
          proofs[index] = null;
          member.reject(error);
        }
      }
    });
    await Promise.race([Promise.all(reads), new Promise<void>((resolve): void => {
      // A slow DNS read must not hold faster, already admitted hops.
      timer = setTimeout(resolve, DNS_CLEAN_PROOF_WINDOW_MS);
    })]);
    open = false;
    if (timer !== undefined) clearTimeout(timer);
    return proofs;
  }

  private async runSolo(host: string, member: HttpDnsCohortMember<Target, Result>): Promise<void> {
    try {
      member.hop.assertCurrent();
      await this.port.recover(host);
      member.hop.assertCurrent();
      const target = await member.hop.admit();
      await this.sendAdmitted(host, [member], target);
    } catch (error) {
      member.reject(error);
    }
  }

  private async sendAdmitted(host: string, members: HttpDnsCohortMember<Target, Result>[], target: Target): Promise<void> {
    const live = members.filter((member: HttpDnsCohortMember<Target, Result>): boolean => {
      try { member.hop.assertCurrent(); return true; }
      catch (error) { member.reject(error); return false; }
    });
    if (live.length === 0) return;
    const needsPin = target.route !== 'systemProxy';
    try {
      if (needsPin) await this.port.install(host, target);
    } catch (error) {
      for (const member of live) member.reject(error);
      if (needsPin) await this.port.release(host);
      return;
    }
    let references = live.length;
    await Promise.all(live.map(async (member: HttpDnsCohortMember<Target, Result>): Promise<void> => {
      let settle: () => void;
      try {
        member.hop.assertCurrent();
        const result = await member.hop.send(target);
        settle = (): void => member.resolve(result);
      } catch (error) {
        settle = (): void => member.reject(error);
      }
      references -= 1;
      try {
        if (needsPin && references === 0) await this.port.release(host);
      } finally {
        settle();
      }
    }));
  }
}
