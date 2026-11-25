import connection from '@ohos.net.connection';

/** Optional reading preparation uses the selected system network only when its
 * unmetered capability is known. Explicit reading/add/download keeps its
 * normal request policy. This host never binds a network or changes a route. */
export class ReaderPreparationNetworkHost {
  private observer: connection.NetConnection | undefined;
  private registered: boolean = false;
  private foreground: boolean = false;
  private closed: boolean = false;
  private epoch: number = 0;
  private admitted: boolean = false;
  private unmeteredWifi: boolean = false;
  private readonly changed: () => void;

  constructor(changed: () => void) { this.changed = changed; }

  allowed(): boolean { return !this.closed && this.foreground && this.registered && this.admitted; }

  /** Deep text prefetch is restricted to the currently selected Wi-Fi route.
   * `allowed()` intentionally remains the broader non-metered admission used
   * by existing shelf preparation. */
  deepAllowed(): boolean {
    return this.allowed() && this.unmeteredWifi;
  }

  setForeground(foreground: boolean): void {
    if (this.closed) return;
    this.foreground = foreground;
    this.epoch += 1;
    this.publish(false, false);
    if (!foreground) return;
    if (this.observer === undefined) {
      try {
        const observer = connection.createNetConnection();
        this.observer = observer;
        const changed = (): void => { void this.refresh(); };
        observer.on('netAvailable', changed);
        observer.on('netLost', changed);
        observer.on('netCapabilitiesChange', changed);
        observer.register((error): void => {
          if (error) {
            this.epoch += 1;
            this.registered = false;
            if (this.observer === observer) this.observer = undefined;
            this.publish(false, false);
            return;
          }
          if (this.closed) { observer.unregister((): void => {}); return; }
          this.registered = true;
          void this.refresh();
        });
      } catch (_) {
        this.observer = undefined;
      }
    }
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    const epoch = ++this.epoch;
    this.publish(false, false);
    if (this.closed || !this.foreground || !this.registered) return;
    try {
      const app = await connection.getAppNet();
      const network = app !== undefined && app !== null && app.netId > 0 ? app : await connection.getDefaultNet();
      if (network === undefined || network === null || network.netId <= 0) return;
      const capabilities = await connection.getNetCapabilities(network);
      if (this.closed || !this.foreground || !this.registered || epoch !== this.epoch) return;
      const bearers = capabilities.bearerTypes;
      this.publish(
        capabilities.networkCap?.includes(connection.NetCap.NET_CAPABILITY_NOT_METERED) === true,
        bearers?.includes(connection.NetBearType.BEARER_WIFI) === true &&
          !bearers.includes(connection.NetBearType.BEARER_CELLULAR),
      );
    } catch (_) {
      if (epoch === this.epoch) this.publish(false, false);
    }
  }

  private publish(allowed: boolean, wifi: boolean): void {
    const unmeteredWifi = allowed && wifi;
    if (this.admitted === allowed && this.unmeteredWifi === unmeteredWifi) return;
    this.admitted = allowed;
    this.unmeteredWifi = unmeteredWifi;
    this.changed();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.registered = false;
    this.epoch += 1;
    this.publish(false, false);
    const observer = this.observer;
    this.observer = undefined;
    if (observer !== undefined) {
      try { observer.unregister((): void => {}); } catch (_) {}
    }
  }
}
