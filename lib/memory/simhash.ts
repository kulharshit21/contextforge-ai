// 64-bit Simhash over token frequencies (Manku et al., WWW 2007 style):
// per-token FNV-1a 64-bit hash, per-bit weight accumulation, fingerprint bit
// set when the accumulated weight is positive. Near-duplicate detection
// compares fingerprints by Hamming distance (<= 3 of 64 bits).
//
// Implemented with BigInt integer arithmetic only, so Node and the Python
// skill compute identical fingerprints for the same text.

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = (1n << 64n) - 1n;

function fnv1a64(token: string): bigint {
  let hash = FNV_OFFSET;
  const bytes = Buffer.from(token, "utf8");
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return hash;
}

export function simhash64(tokens: string[]): bigint {
  const weights = new Array<number>(64).fill(0);
  for (const token of tokens) {
    const hash = fnv1a64(token);
    for (let bit = 0; bit < 64; bit++) {
      if ((hash >> BigInt(bit)) & 1n) {
        weights[bit] += 1;
      } else {
        weights[bit] -= 1;
      }
    }
  }
  let fingerprint = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit] > 0) {
      fingerprint |= 1n << BigInt(bit);
    }
  }
  return fingerprint;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let distance = 0;
  let diff = a ^ b;
  while (diff) {
    if (diff & 1n) distance++;
    diff >>= 1n;
  }
  return distance;
}

export function popcount(a: bigint): number {
  let distance = 0;
  let value = a;
  while (value) {
    if (value & 1n) distance++;
    value >>= 1n;
  }
  return distance;
}
