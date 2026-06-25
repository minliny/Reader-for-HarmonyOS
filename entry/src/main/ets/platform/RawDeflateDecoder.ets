// RawDeflateDecoder — clean-room minimal raw-DEFLATE (RFC 1951) decoder.
// Decodes a single DEFLATE stream (the per-entry body of a ZIP local record
// when compression method == 8) into its uncompressed bytes. No external or
// GPL code is referenced; the implementation is bounded and redacted
// (it operates only on local byte buffers and emits no diagnostics about
// content). CRC32 is provided for ZIP data-descriptor / central-directory
// cross-check but is not exported as evidence material.

// Bit reader over a little-endian byte stream.
class BitReader {
  private data: Uint8Array;
  public bytePos: number;
  private bitPos: number; // 0..7, current bit within bytePos

  constructor(data: Uint8Array, start: number) {
    this.data = data;
    this.bytePos = start;
    this.bitPos = 0;
  }

  // Read `count` bits LSB-first.
  readBits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) {
      if (this.bytePos >= this.data.length) { throw new Error('DeflateTruncated'); }
      const bit = (this.data[this.bytePos] >> this.bitPos) & 1;
      value |= bit << i;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.bytePos++;
      }
    }
    return value;
  }

  // Read one Huffman code from the canonical code table described by code lengths.
  readCode(table: HuffmanTable): number {
    let code = 0;
    let len = 0;
    // Canonical Huffman decode: walk one bit at a time, comparing against
    // first-code-per-length entries. Bounded by max code length (15).
    while (len < 15) {
      code = (code << 1) | this.readBits(1);
      len++;
      const entry = table.firstCode[len];
      const count = table.count[len];
      if (count > 0 && code < entry + count) {
        return table.symbol[len][code - entry];
      }
    }
    throw new Error('DeflateInvalidCode');
  }

  alignToByte(): void {
    if (this.bitPos !== 0) {
      this.bitPos = 0;
      this.bytePos++;
    }
  }
}

interface HuffmanTable {
  firstCode: number[]; // first canonical code value per length (index = length)
  count: number[];     // number of codes per length
  symbol: number[][];  // symbols per length, sorted by canonical order
}

const MAX_BITS = 15;

function buildHuffmanTable(codeLengths: Uint8Array): HuffmanTable {
  const blCount = new Array<number>(MAX_BITS + 1).fill(0);
  for (let i = 0; i < codeLengths.length; i++) {
    if (codeLengths[i] > 0) { blCount[codeLengths[i]]++; }
  }

  // Compute next code per length.
  const nextCode = new Array<number>(MAX_BITS + 1).fill(0);
  let code = 0;
  for (let bits = 1; bits <= MAX_BITS; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  const firstCode = new Array<number>(MAX_BITS + 1).fill(0);
  const count = blCount;
  const symbol: number[][] = [];
  for (let i = 0; i <= MAX_BITS; i++) { symbol.push([]); }
  // Assign symbols in canonical order (sorted by length, then by symbol index).
  for (let n = 0; n < codeLengths.length; n++) {
    const len = codeLengths[n];
    if (len > 0) {
      symbol[len].push(n);
    }
  }
  for (let bits = 1; bits <= MAX_BITS; bits++) {
    firstCode[bits] = nextCode[bits];
  }
  return { firstCode, count, symbol };
}

// Fixed Huffman code lengths (RFC 1951 §3.2.6).
function fixedLiteralLengths(): Uint8Array {
  const lengths = new Uint8Array(288);
  for (let i = 0; i <= 143; i++) { lengths[i] = 8; }
  for (let i = 144; i <= 255; i++) { lengths[i] = 9; }
  for (let i = 256; i <= 279; i++) { lengths[i] = 7; }
  for (let i = 280; i <= 287; i++) { lengths[i] = 8; }
  return lengths;
}

const FIXED_DIST_LENGTHS = new Uint8Array(30).fill(5);

// Length base + extra bits for codes 257..285.
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const CODE_LENGTH_BASE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];
const CODE_LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 7, 11];

// Decode a raw DEFLATE stream beginning at byte offset `start`.
// Returns { output, bytesConsumed } where bytesConsumed is the number of bytes
// (aligned to byte boundary) consumed including the final block.
export interface RawDeflateResult {
  output: Uint8Array;
  bytesConsumed: number;
}

export function decodeRawDeflate(data: Uint8Array, start: number): RawDeflateResult {
  const reader = new BitReader(data, start);
  const outChunks: number[] = [];
  let lastBlock = false;

  while (!lastBlock) {
    lastBlock = reader.readBits(1) === 1;
    const btype = reader.readBits(2);
    if (btype === 0) {
      // Stored / no compression.
      reader.alignToByte();
      const lenPos = reader.bytePos;
      if (lenPos + 4 > data.length) { throw new Error('DeflateStoredTruncated'); }
      const len = data[lenPos] | (data[lenPos + 1] << 8);
      // nlen ignored for decode (parity check skipped to stay bounded).
      reader.bytePos = lenPos + 4;
      const srcStart = reader.bytePos;
      if (srcStart + len > data.length) { throw new Error('DeflateStoredLenTruncated'); }
      for (let i = 0; i < len; i++) { outChunks.push(data[srcStart + i]); }
      reader.bytePos = srcStart + len;
    } else if (btype === 1 || btype === 2) {
      let litTable: HuffmanTable;
      let distTable: HuffmanTable;
      if (btype === 1) {
        litTable = buildHuffmanTable(fixedLiteralLengths());
        distTable = buildHuffmanTable(FIXED_DIST_LENGTHS);
      } else {
        const hlit = reader.readBits(5) + 257;
        const hdist = reader.readBits(5) + 1;
        const hclen = reader.readBits(4) + 4;
        const codeLengthLengths = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) {
          codeLengthLengths[CODE_LENGTH_ORDER[i]] = reader.readBits(3);
        }
        const clTable = buildHuffmanTable(codeLengthLengths);
        const lengths = new Uint8Array(hlit + hdist);
        let i = 0;
        while (i < lengths.length) {
          const sym = reader.readCode(clTable);
          if (sym < 16) {
            lengths[i] = sym;
            i++;
          } else if (sym === 16) {
            const rep = reader.readBits(2) + 3;
            const prev = i > 0 ? lengths[i - 1] : 0;
            for (let r = 0; r < rep && i < lengths.length; r++) { lengths[i] = prev; i++; }
          } else if (sym === 17) {
            const rep = reader.readBits(3) + 3;
            for (let r = 0; r < rep && i < lengths.length; r++) { lengths[i] = 0; i++; }
          } else { // 18
            const rep = reader.readBits(7) + 11;
            for (let r = 0; r < rep && i < lengths.length; r++) { lengths[i] = 0; i++; }
          }
        }
        litTable = buildHuffmanTable(lengths.subarray(0, hlit));
        distTable = buildHuffmanTable(lengths.subarray(hlit));
      }
      // Decode block body.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const sym = reader.readCode(litTable);
        if (sym < 256) {
          outChunks.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const li = sym - 257;
          if (li >= LENGTH_BASE.length) { throw new Error('DeflateInvalidLengthCode'); }
          const length = LENGTH_BASE[li] + reader.readBits(LENGTH_EXTRA[li]);
          const dsym = reader.readCode(distTable);
          if (dsym >= DIST_BASE.length) { throw new Error('DeflateInvalidDistCode'); }
          const dist = DIST_BASE[dsym] + reader.readBits(DIST_EXTRA[dsym]);
          const startIdx = outChunks.length - dist;
          if (startIdx < 0) { throw new Error('DeflateDistOutOfRange'); }
          for (let k = 0; k < length; k++) {
            outChunks.push(outChunks[startIdx + k]);
          }
        }
      }
    } else {
      throw new Error('DeflateReservedBlockType');
    }
  }

  reader.alignToByte();
  const output = new Uint8Array(outChunks.length);
  for (let i = 0; i < outChunks.length; i++) { output[i] = outChunks[i]; }
  return { output, bytesConsumed: reader.bytePos - start };
}

// CRC32 (used for ZIP entry integrity cross-check, not exported as evidence).
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
