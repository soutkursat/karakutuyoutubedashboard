// Saf JS SHA-256. crypto.subtle yalnızca HTTPS/localhost'ta çalıştığı için
// (ör. telefondan yerel IP ile açınca) her ortamda aynı sonucu veren bu sürümü kullanıyoruz.
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

function primes(count: number): number[] {
  const out: number[] = []
  for (let n = 2; out.length < count; n++) {
    if (out.every((p) => n % p !== 0)) out.push(n)
  }
  return out
}

const frac32 = (x: number) => Math.floor((x - Math.floor(x)) * 0x100000000) >>> 0
const P = primes(64)
const K = P.map((p) => frac32(Math.cbrt(p)))
const H0 = P.slice(0, 8).map((p) => frac32(Math.sqrt(p)))

export function sha256(message: string): string {
  const bytes = new TextEncoder().encode(message)
  const len = bytes.length
  const padded = (((len + 9 + 63) >> 6) << 6)
  const buf = new Uint8Array(padded)
  buf.set(bytes)
  buf[len] = 0x80
  const dv = new DataView(buf.buffer)
  dv.setUint32(padded - 8, Math.floor(len / 0x20000000))
  dv.setUint32(padded - 4, (len << 3) >>> 0)

  const H = H0.slice()
  const W = new Uint32Array(64)
  for (let off = 0; off < padded; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('')
}
