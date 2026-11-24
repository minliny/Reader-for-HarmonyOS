import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import picker from '@ohos.file.picker';
import statvfs from '@ohos.file.statvfs';
import crypto from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { ReaderDocumentPickerActivity } from '../ReaderDocumentPickerActivity';

export const LOCAL_RECOVERY_MAX_BYTES = 512 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
const MAGIC = 'ReaderLocalRecovery/1\n';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FILTER = 'Reader 本地恢复包|.readerbackup';

type ChunkSink = (bytes: Uint8Array) => Promise<void>;

export class LocalRecoveryFileError extends Error {
  constructor(readonly reason: 'rejected' | 'tooLarge' | 'cancelled') { super(reason); }
}

export function recoveryUtf8(text: string): Uint8Array {
  return new util.TextEncoder('utf-8').encodeInto(text);
}

export function recoveryText(bytes: Uint8Array): string {
  return util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
}

export async function recoveryDigest(bytes: Uint8Array): Promise<string> {
  const md = crypto.createMd('SHA256');
  await md.update({ data: bytes });
  return hex((await md.digest()).data);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recoveryRead(fd: number, length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length);
  let cursor = 0;
  while (cursor < length) {
    const part = new ArrayBuffer(Math.min(CHUNK_BYTES, length - cursor));
    const read = await fileIo.read(fd, part);
    if (read <= 0 || read > part.byteLength) throw new LocalRecoveryFileError('rejected');
    bytes.set(new Uint8Array(part, 0, read), cursor);
    cursor += read;
  }
  return bytes;
}

async function write(fd: number, bytes: Uint8Array): Promise<void> {
  let cursor = 0;
  while (cursor < bytes.length) {
    const part = bytes.slice(cursor, cursor + CHUNK_BYTES);
    const written = await fileIo.write(fd, part.buffer);
    if (written <= 0 || written > part.length) throw new Error('Recovery destination stopped accepting bytes');
    cursor += written;
  }
}

export async function recoveryOutput(path: string, output: (emit: ChunkSink) => Promise<void>): Promise<void> {
  const file = await fileIo.open(path, fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
  try {
    await output((bytes) => write(file.fd, bytes));
    await fileIo.fsync(file.fd);
  } finally { await fileIo.close(file); }
}

export async function recoveryCopyBytes(fd: number, size: number, emit: ChunkSink,
  current: () => boolean): Promise<string> {
  const digest = crypto.createMd('SHA256');
  for (let remaining = size; remaining > 0;) {
    if (!current()) throw new LocalRecoveryFileError('cancelled');
    const bytes = await recoveryRead(fd, Math.min(remaining, CHUNK_BYTES));
    await digest.update({ data: bytes });
    await emit(bytes);
    remaining -= bytes.length;
  }
  return hex((await digest.digest()).data);
}

export async function recoveryHashFile(path: string): Promise<string> {
  return recoveryVisitFile(path, async () => {}, () => true);
}

export async function recoveryVisitFile(path: string, emit: ChunkSink, current: () => boolean,
  expectedSize?: number): Promise<string> {
  const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
  try {
    const size = (await fileIo.stat(file.fd)).size;
    if (!Number.isSafeInteger(size) || size <= 0 || size > LOCAL_RECOVERY_MAX_BYTES) {
      throw new LocalRecoveryFileError(size > LOCAL_RECOVERY_MAX_BYTES ? 'tooLarge' : 'rejected');
    }
    if (expectedSize !== undefined && size !== expectedSize) throw new LocalRecoveryFileError('rejected');
    const digest = await recoveryCopyBytes(file.fd, size, emit, current);
    if ((await fileIo.read(file.fd, new ArrayBuffer(1))) !== 0) throw new LocalRecoveryFileError('rejected');
    return digest;
  } finally { await fileIo.close(file); }
}

export async function recoveryReserve(directory: string, bytes: number): Promise<void> {
  if (await statvfs.getFreeSize(directory) < bytes + 16 * CHUNK_BYTES) {
    throw new Error('Insufficient space for local recovery staging');
  }
}

async function cipher(passphrase: string, header: Uint8Array, tag?: Uint8Array): Promise<crypto.Cipher> {
  const keySpec: crypto.PBKDF2Spec = {
    algName: 'PBKDF2', password: passphrase, salt: header.slice(MAGIC.length, MAGIC.length + SALT_BYTES),
    iterations: 600000, keySize: 32,
  };
  const material = await crypto.createKdf('PBKDF2|SHA256').generateSecret(keySpec);
  const gcm = crypto.createCipher('AES256|GCM|NoPadding');
  const spec: crypto.GcmParamsSpec = {
    algName: 'GcmParamsSpec',
    iv: { data: header.slice(MAGIC.length + SALT_BYTES) },
    aad: { data: header },
    authTag: { data: tag ?? new Uint8Array(TAG_BYTES) },
  };
  try {
    const key = await crypto.createSymKeyGenerator('AES256').convertKey(material);
    await gcm.init(tag === undefined ? crypto.CryptoMode.ENCRYPT_MODE : crypto.CryptoMode.DECRYPT_MODE, key, spec);
  } finally { material.data.fill(0); }
  return gcm;
}

export async function sealRecoveryFile(path: string, passphrase: string,
  contents: (emit: ChunkSink) => Promise<void>): Promise<void> {
  const header = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES);
  header.set(recoveryUtf8(MAGIC));
  header.set((await crypto.createRandom().generateRandom(SALT_BYTES + IV_BYTES)).data, MAGIC.length);
  const gcm = await cipher(passphrase, header);
  await recoveryOutput(path, async (emit): Promise<void> => {
    await emit(header);
    let total = header.length + TAG_BYTES;
    await contents(async (bytes): Promise<void> => {
      total += bytes.length;
      if (total > LOCAL_RECOVERY_MAX_BYTES) throw new LocalRecoveryFileError('tooLarge');
      for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
        const chunk = bytes.slice(offset, offset + CHUNK_BYTES);
        const result = await gcm.update({ data: chunk });
        if (result !== null) await emit(result.data);
      }
    });
    await emit((await gcm.doFinal(null)).data);
  });
}

/** Decryption writes only into private quarantine. No caller can read it until the tag verifies. */
export async function openRecoveryFile(path: string, plaintext: string, passphrase: string,
  current: () => boolean): Promise<void> {
  const headerBytes = MAGIC.length + SALT_BYTES + IV_BYTES;
  const size = (await fileIo.stat(path)).size;
  if (size <= headerBytes + TAG_BYTES || size > LOCAL_RECOVERY_MAX_BYTES) {
    throw new LocalRecoveryFileError(size > LOCAL_RECOVERY_MAX_BYTES ? 'tooLarge' : 'rejected');
  }
  const source = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
  try {
    const header = await recoveryRead(source.fd, headerBytes);
    if (recoveryText(header.slice(0, MAGIC.length)) !== MAGIC) throw new LocalRecoveryFileError('rejected');
    await fileIo.lseek(source.fd, -TAG_BYTES, fileIo.WhenceType.SEEK_END);
    const tag = await recoveryRead(source.fd, TAG_BYTES);
    await fileIo.lseek(source.fd, headerBytes, fileIo.WhenceType.SEEK_SET);
    const gcm = await cipher(passphrase, header, tag);
    await recoveryOutput(plaintext, async (emit): Promise<void> => {
      await recoveryCopyBytes(source.fd, size - headerBytes - TAG_BYTES, async (bytes): Promise<void> => {
        const result = await gcm.update({ data: bytes });
        if (result !== null) await emit(result.data);
      }, current);
      let final: crypto.DataBlob | null;
      try { final = await gcm.doFinal(null); }
      catch (_) { throw new LocalRecoveryFileError('rejected'); }
      if (final !== null) await emit(final.data);
    });
  } finally { await fileIo.close(source); }
}

export async function selectRecoveryDocument(context: common.UIAbilityContext, save: boolean):
  Promise<string | undefined> {
  const activity = ReaderDocumentPickerActivity.begin();
  try {
    const document = new picker.DocumentViewPicker(context);
    if (save) {
      const options = new picker.DocumentSaveOptions();
      options.newFileNames = [`Reader-${new Date().toISOString().slice(0, 10)}.readerbackup`];
      options.fileSuffixChoices = [FILTER];
      return (await document.save(options))[0];
    }
    const options = new picker.DocumentSelectOptions();
    options.maxSelectNumber = 1;
    options.fileSuffixFilters = [FILTER];
    return (await document.select(options))[0];
  } finally { activity.finish(); }
}
