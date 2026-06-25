// DeflateEncoder — clean-room minimal DEFLATE encoder using stored (btype=0)
// sub-blocks. Produces a valid raw-DEFLATE stream that RawDeflateDecoder can
// round-trip. Used only for building compressed archive fixtures in evidence;
// no external or GPL code is referenced. Output is bounded by the input size.

// Encode `input` as one or more stored DEFLATE blocks. Each stored block
// payload is at most 65535 bytes per the spec. Returns the raw DEFLATE bytes
// (to be placed as the per-entry body of a ZIP local record with method=8).
export function encodeStoredDeflate(input: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  do {
    const remaining = input.length - offset;
    const len = remaining > 65535 ? 65535 : remaining;
    // BFINAL (1 bit) set when this is the last block; BTYPE (2 bits) = 00 (stored).
    const headerByte = (remaining - len <= 0 ? 1 : 0); // bfinal in bit0, btype=00
    const block = new Uint8Array(5 + len);
    block[0] = headerByte;
    block[1] = len & 0xFF;
    block[2] = (len >> 8) & 0xFF;
    const nlen = (~len) & 0xFFFF;
    block[3] = nlen & 0xFF;
    block[4] = (nlen >> 8) & 0xFF;
    block.set(input.subarray(offset, offset + len), 5);
    chunks.push(block);
    offset += len;
  } while (offset < input.length);
  let total = 0;
  for (let i = 0; i < chunks.length; i++) { total += chunks[i].length; }
  const out = new Uint8Array(total);
  let pos = 0;
  for (let i = 0; i < chunks.length; i++) { out.set(chunks[i], pos); pos += chunks[i].length; }
  return out;
}
