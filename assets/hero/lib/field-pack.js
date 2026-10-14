// Lossless packing of the hero's Int16 distance fields (checkpoint 14).
// The fields are smooth, so each value is stored as its difference from the left neighbour (first column: from the
// value above), and the low and high bytes of those differences go in two separate planes before gzip. That makes the
// stream extremely repetitive: 3 MB → ~0.36 MB (sdf) and ~0.24 MB (dome), decoded bit for bit (the geometry does not
// change). Packed offline by explorations/tools/pack-fields.mjs; unpacked here with the browser's DecompressionStream.

// planes: Uint8Array [lo bytes of the deltas | hi bytes], W: row width → Int16Array of the original values
export function unpackDeltaPlanes(planes, W) {
  const n = planes.length >> 1, out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const d = (planes[i] | (planes[n + i] << 8)) << 16 >> 16;   // sign-extend the 16-bit delta
    const ref = i % W ? out[i - 1] : (i >= W ? out[i - W] : 0);
    out[i] = (ref + d) << 16 >> 16;
  }
  return out;
}

export function packDeltaPlanes(values, W) {   // the inverse (used offline and by the tests)
  const n = values.length, planes = new Uint8Array(2 * n);
  for (let i = 0; i < n; i++) {
    const ref = i % W ? values[i - 1] : (i >= W ? values[i - W] : 0), d = (values[i] - ref) & 0xffff;
    planes[i] = d & 255; planes[n + i] = d >> 8;
  }
  return planes;
}

// gzip bytes → bytes. Also accepts data a server already decompressed (Content-Encoding), by checking the gzip magic.
export async function gunzip(buf) {
  const u = new Uint8Array(buf);
  if (!(u[0] === 0x1f && u[1] === 0x8b)) return u;
  const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
