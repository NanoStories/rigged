// Factoring runs here so the page stays responsive while the House thinks.
import { factorize } from "./primes-core.js";

self.addEventListener("message", (event) => {
  const { id, n, budget } = event.data;
  const { primes, leftovers } = factorize(BigInt(n), budget);
  self.postMessage({ id, primes: primes.map(String), leftovers: leftovers.map(String) });
});
