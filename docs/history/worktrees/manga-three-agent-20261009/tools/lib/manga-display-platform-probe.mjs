import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, openSync, writeSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { createMangaAtomicPayloadReaderFixture } from './manga-atomic-payload-probe.mjs';
import { PlatformLRU } from './platform-lru-cache-port.mjs';

function platformStat(path) {
  const stat = statSync(path, { bigint: true });
  return { ino: stat.ino, size: Number(stat.size), mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs,
    isFile: () => stat.isFile(), isDirectory: () => stat.isDirectory() };
}

export function createMangaDisplayPlatformFixture() {
  const fs = {
    OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
    async access(path) { return existsSync(path); },
    async stat(path) { return platformStat(path); }, statSync: platformStat,
    async listFile(path) { return readdirSync(path); },
    async mkdir(path) { mkdirSync(path, { recursive: true }); },
    async open(path) { return { fd: openSync(path, 'w+') }; },
    async write(fd, value) { return writeSync(fd, new Uint8Array(value)); },
    async close(file) { closeSync(file.fd); },
    async rename(a, b) { renameSync(a, b); },
    async unlink(path) { unlinkSync(path); },
    AtomicFile: class { constructor(path) { this.path = path; } readFully() { const bytes = readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } },
  };
  const util = { LRUCache: PlatformLRU, TextEncoder: class { encodeInto(text) { return new TextEncoder().encode(text); } },
    TextDecoder: class { decodeWithStream(bytes) { return new TextDecoder().decode(bytes); } } };
  const cryptoFramework = { createMd() { const hash = createHash('sha256'); return { async update({ data }) { hash.update(data); },
    async digest() { return { data: new Uint8Array(hash.digest()) }; } }; } };
  const atomicReadHooks = {}, readMangaAtomicPayload = createMangaAtomicPayloadReaderFixture(fs, atomicReadHooks);
  function load(name, dependencies) {
    const source = readFileSync(new URL(`../../entry/src/main/ets/app/${name}.ts`, import.meta.url), 'utf8')
      .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
    return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
  }
  const MangaDisplayRetention = load('MangaDisplayRetention', { fs, util, readMangaAtomicPayload });
  const Body = load('ReadingBodyImageHost', { fs, util, cryptoFramework, MangaDisplayRetention });
  return { fs, util, cryptoFramework, atomicReadHooks, readMangaAtomicPayload, MangaDisplayRetention, Body, load };
}
