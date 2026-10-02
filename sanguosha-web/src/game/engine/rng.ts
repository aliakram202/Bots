// sfc32: small, fast, deterministic PRNG with 128-bit state.
// Tests use fixed seeds; production seeds come from crypto.getRandomValues on the server
// and never leave the server, so players cannot predict the shuffle.
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: [number, number, number, number]) {
    [this.a, this.b, this.c, this.d] = seed.map((x) => x >>> 0) as [number, number, number, number];
    for (let i = 0; i < 15; i++) this.next();
  }

  next(): number {
    let { a, b, c, d } = this;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return (t >>> 0) / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(arr.length)];
  }
}
