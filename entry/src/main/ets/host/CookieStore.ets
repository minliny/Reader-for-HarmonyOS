// CookieStore — host-owned cookie storage interface + in-memory implementation.
//
// Mirrors Android `app/src/main/kotlin/com/reader/android/data/adapter/CookieStore.kt`
// and Swift `ScopedCookieJar`. Per charter §4 / §10.2: cookie persistence is a
// host concern — Core never touches the platform cookie jar directly, it emits
// cookie.get / cookie.set host.request events and the host routes them through
// CookieGetHandler / CookieSetHandler to a CookieStore implementation.
//
// JSON contract (aligned with Android CookieGetHandler / CookieSetHandler):
// - cookie.get request  params: {url}
// - cookie.get result          : {cookies: [{name, value, domain, path, secure?, httpOnly?, expiresAt?}]}
// - cookie.set request  params: {url, cookie: {name, value, domain?, path?, secure?, httpOnly?, expiresAt?}}
// - cookie.set result          : {stored: true}
//
// On-device, a future ArkWeb-backed CookieStore can replace InMemoryCookieStore
// (the WebView CookieManager is the production jar). InMemoryCookieStore is the
// hermetic default used by HostRuntime and by the login_cookie proof tests.

export interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expiresAt?: number;
}

export interface CookieScope {
  sourceUrl: string;
  cookies: CookieRecord[];
}

export interface CookieStore {
  get(sourceUrl: string): CookieScope;
  save(sourceUrl: string, cookies: CookieRecord[]): void;
  clear(sourceUrl: string): void;
  clearAll(): void;
}

// InMemoryCookieStore — hermetic Map-based CookieStore. Mirrors Android
// FakeCookieStore / InMemoryCookieStore used by HostLoginCookieProofTest.
// save() upserts by (name, domain): an existing cookie with the same name +
// domain is replaced, matching Android's behavior.
export class InMemoryCookieStore implements CookieStore {
  private store: Map<string, CookieRecord[]> = new Map<string, CookieRecord[]>();

  get(sourceUrl: string): CookieScope {
    const records = this.store.get(sourceUrl);
    if (records === undefined) {
      return { sourceUrl: sourceUrl, cookies: [] } as CookieScope;
    }
    // Return a shallow copy so callers cannot mutate the stored array.
    const snapshot: CookieRecord[] = [];
    for (let i = 0; i < records.length; i++) {
      snapshot.push(records[i]);
    }
    return { sourceUrl: sourceUrl, cookies: snapshot } as CookieScope;
  }

  save(sourceUrl: string, cookies: CookieRecord[]): void {
    let list = this.store.get(sourceUrl);
    if (list === undefined) {
      list = [];
      this.store.set(sourceUrl, list);
    }
    for (let i = 0; i < cookies.length; i++) {
      const newCookie = cookies[i];
      let replaced = false;
      for (let j = 0; j < list.length; j++) {
        const existing = list[j];
        if (existing.name === newCookie.name && existing.domain === newCookie.domain) {
          list[j] = newCookie;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        list.push(newCookie);
      }
    }
    this.store.set(sourceUrl, list);
  }

  clear(sourceUrl: string): void {
    this.store.delete(sourceUrl);
  }

  clearAll(): void {
    this.store.clear();
  }
}
