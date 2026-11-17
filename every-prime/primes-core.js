// Prime testing and factoring with BigInt, shared by the page and its worker.

const SMALL_LIMIT = 100000;
let smallPrimes = null;

export function getSmallPrimes() {
  if (smallPrimes) return smallPrimes;
  const composite = new Uint8Array(SMALL_LIMIT + 1);
  const found = [];
  for (let i = 2; i <= SMALL_LIMIT; i++) {
    if (composite[i]) continue;
    found.push(i);
    for (let j = i * i; j <= SMALL_LIMIT; j += i) composite[j] = 1;
  }
  smallPrimes = found;
  return found;
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
}

const WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

/** Miller–Rabin. Deterministic below 3.3 × 10^24; beyond that the chance
 *  of a wrong answer with these thirteen witnesses is negligible. */
export function isPrime(n) {
  if (n < 2n) return false;
  for (const p of WITNESSES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s += 1;
  }
  witness: for (const a of WITNESSES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

/** Smallest prime factor below 100,000, or null. */
export function smallFactor(n) {
  for (const p of getSmallPrimes()) {
    const bp = BigInt(p);
    if (bp * bp > n) return null;
    if (n % bp === 0n) return bp;
  }
  return null;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function randomBelow(n) {
  const r = BigInt(Math.floor(Math.random() * 2 ** 52)) * BigInt(Math.floor(Math.random() * 2 ** 52));
  return (r % (n - 1n)) + 1n;
}

/** Pollard's rho with Brent's cycle finding. Returns a non-trivial factor or null. */
function brent(n, deadline) {
  if (n % 2n === 0n) return 2n;
  const BATCH = 128;
  for (let attempt = 0; attempt < 16; attempt++) {
    let y = randomBelow(n);
    const c = randomBelow(n);
    let g = 1n;
    let r = 1;
    let q = 1n;
    let x = y;
    let ys = y;
    while (g === 1n) {
      x = y;
      for (let i = 0; i < r; i++) {
        y = (y * y + c) % n;
        if ((i & 4095) === 4095 && Date.now() > deadline) return null;
      }
      let k = 0;
      while (k < r && g === 1n) {
        ys = y;
        const limit = Math.min(BATCH, r - k);
        for (let i = 0; i < limit; i++) {
          y = (y * y + c) % n;
          q = (q * (x > y ? x - y : y - x)) % n;
        }
        g = gcd(q, n);
        k += BATCH;
        if (Date.now() > deadline) return null;
      }
      r *= 2;
    }
    if (g === n) {
      g = 1n;
      for (let guard = 0; g === 1n && guard < 1 << 16; guard++) {
        ys = (ys * ys + c) % n;
        g = gcd(x > ys ? x - ys : ys - x, n);
      }
    }
    if (g !== n && g !== 1n) return g;
  }
  return null;
}

/** Factor n as far as the time budget allows.
 *  `primes` are proven (or overwhelmingly likely) prime factors, smallest first;
 *  `leftovers` are composite pieces the House ran out of time on. */
export function factorize(n, budgetMs = 2500) {
  const deadline = Date.now() + budgetMs;
  const primes = [];
  const leftovers = [];
  let rest = n;
  for (const p of getSmallPrimes()) {
    const bp = BigInt(p);
    if (bp * bp > rest) break;
    while (rest % bp === 0n) {
      primes.push(bp);
      rest /= bp;
    }
  }
  const stack = rest > 1n ? [rest] : [];
  while (stack.length) {
    const m = stack.pop();
    if (m === 1n) continue;
    if (isPrime(m)) {
      primes.push(m);
      continue;
    }
    const d = Date.now() < deadline ? brent(m, deadline) : null;
    if (!d) {
      leftovers.push(m);
      continue;
    }
    stack.push(d, m / d);
  }
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { primes, leftovers };
}
