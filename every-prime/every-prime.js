import { isPrime, smallFactor, factorize } from "./primes-core.js";
import * as store from "../assets/js/store.js";
import { show, hide, times, wait, listJoin, reducedMotion } from "../assets/js/util.js";

const $ = (id) => document.getElementById(id);
const form = $("form");
const textarea = $("primes");
const errorEl = $("error");
const noteEl = $("form-note");
const submitBtn = $("submit");
const firstTenBtn = $("first-ten");
const slip = $("slip");
const steps = [...slip.querySelectorAll("ol > li")];
const exprEl = $("s-expression");
const productEl = $("s-product");
const nEl = $("s-n");
const remList = $("s-remainders");
const remNote = $("s-remainders-note");
const factorsEl = $("s-factors");
const verdictBox = $("verdict");
const verdictEl = $("s-verdict");
const addBtn = $("add-missed");
const whyBtn = $("why");
const newListBtn = $("new-list");
const proof = $("proof");
const pProduct = $("p-product");
const pN = $("p-n");
const tallyEl = $("tally");

const NOTE = noteEl.textContent;
const MAX_ENTRIES = 200;
const MAX_DIGITS = 40;
const MAX_FACTOR_DIGITS = 400;
const SHOWN_REMAINDERS = 10;
const FIRST_TEN = "2, 3, 5, 7, 11, 13, 17, 19, 23, 29";

const fmt = (n) => n.toLocaleString("en-US");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

let busy = false;
let lastRound = null;

/* ---------------- Factoring off the main thread ---------------- */

let worker = null;
let jobs = 0;
try {
  worker = new Worker(new URL("./factor-worker.js", import.meta.url), { type: "module" });
} catch {
  worker = null;
}

function factorAsync(n, budget) {
  if (!worker) return Promise.resolve(factorize(n, Math.min(budget, 900)));
  const current = worker;
  return new Promise((resolve) => {
    const id = ++jobs;
    const finish = (result) => {
      current.removeEventListener("message", onMessage);
      current.removeEventListener("error", onError);
      resolve(result);
    };
    const onMessage = (event) => {
      if (event.data.id !== id) return;
      finish({ primes: event.data.primes.map(BigInt), leftovers: event.data.leftovers.map(BigInt) });
    };
    const onError = () => {
      worker = null;
      finish(factorize(n, Math.min(budget, 900)));
    };
    current.addEventListener("message", onMessage);
    current.addEventListener("error", onError);
    current.postMessage({ id, n: n.toString(), budget });
  });
}

/* ---------------- Reading the list ---------------- */

function parse(text) {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length > MAX_ENTRIES) {
    return { error: `That’s a long list. The House checks up to ${MAX_ENTRIES} primes at a time.` };
  }
  const seen = new Set();
  const primes = [];
  const repeats = [];
  for (const token of tokens) {
    const clean = token.replace(/^\+/, "").replace(/\.$/, "");
    if (!/^\d+$/.test(clean)) return { error: `“${token}” isn’t a positive whole number.` };
    if (clean.replace(/^0+/, "").length > MAX_DIGITS) {
      return { error: `The House only takes numbers up to ${MAX_DIGITS} digits long.` };
    }
    const n = BigInt(clean);
    if (n < 2n) return { error: `${n} isn’t prime. The primes start at 2.` };
    if (!isPrime(n)) {
      const f = smallFactor(n);
      return { error: f ? `${fmt(n)} isn’t prime: it’s ${fmt(f)} × ${fmt(n / f)}.` : `${fmt(n)} isn’t prime.` };
    }
    const key = n.toString();
    if (seen.has(key)) {
      if (!repeats.includes(key)) repeats.push(key);
      continue;
    }
    seen.add(key);
    primes.push(n);
  }
  primes.sort(cmp);
  return { primes, repeats };
}

/* ---------------- Showing the House's working ---------------- */

/** Long numbers are shortened to their first and last digits, and may
 *  only wrap after a thousands comma. Returns HTML (digits and punctuation only). */
function big(n) {
  const s = n.toString();
  if (s.length <= 12) return fmt(n);
  if (s.length <= 120) return fmt(n).replaceAll(",", ",<wbr>");
  return `${s.slice(0, 15)}…${s.slice(-15)} (${s.length} digits)`;
}

function expression(primes) {
  const parts = primes.map(fmt);
  if (parts.length > 14) return `${parts.slice(0, 6).join(" × ")} × … × ${parts.slice(-3).join(" × ")}`;
  return parts.join(" × ");
}

function factorHtml(n, primes, leftovers) {
  if (!primes.length) return "The House didn’t finish breaking it down. It doesn’t need to.";
  if (primes.length === 1 && !leftovers.length) return `${big(n)} is prime itself.`;
  const groups = [];
  for (const p of primes) {
    const last = groups[groups.length - 1];
    if (last && last.p === p) last.k += 1;
    else groups.push({ p, k: 1 });
  }
  const parts = groups.map(({ p, k }) => (k > 1 ? `${big(p)}<sup>${k}</sup>` : big(p)));
  for (const m of leftovers) parts.push(`(a ${m.toString().length}-digit number it didn’t finish)`);
  return `${big(n)} = ${parts.join(" × ")}`;
}

function reveal(li) {
  li.classList.remove("pending");
  li.classList.add("shown");
}

function renderTally(losses = Number(store.get("primes.losses", 0)) || 0) {
  tallyEl.textContent = losses ? `You’ve lost here ${times(losses)}.` : "";
}

async function play(primes) {
  busy = true;
  submitBtn.disabled = true;
  hide(verdictBox);
  for (const li of steps) {
    li.classList.remove("shown");
    li.classList.add("pending");
  }
  show(slip);
  const top = slip.getBoundingClientRect().top;
  if (top > window.innerHeight - 120) {
    slip.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  const product = primes.reduce((a, b) => a * b, 1n);
  const N = product + 1n;
  const tooBig = N.toString().length > MAX_FACTOR_DIGITS;
  const factoring = tooBig ? Promise.resolve({ primes: [], leftovers: [N] }) : factorAsync(N, 2500);

  if (primes.length) {
    exprEl.textContent = expression(primes);
    productEl.innerHTML = `= ${big(product)}`;
  } else {
    exprEl.textContent = "Your list is empty, and multiplying no numbers at all gives 1.";
    productEl.innerHTML = "= 1";
  }
  nEl.innerHTML = big(N);

  remList.replaceChildren();
  for (const p of primes.slice(0, SHOWN_REMAINDERS)) {
    const chip = document.createElement("li");
    chip.textContent = `${fmt(p)} leaves ${fmt(N % p)}`;
    remList.append(chip);
  }
  if (!primes.length) remNote.textContent = "There’s nothing on your list to divide by.";
  else if (primes.length > SHOWN_REMAINDERS) {
    remNote.textContent = `The other ${primes.length - SHOWN_REMAINDERS} leave 1 too. None of your primes divides it.`;
  } else remNote.textContent = primes.length === 1 ? "Your prime doesn’t divide it." : "Every one leaves 1, so none of your primes divides it.";
  factorsEl.textContent = "Working…";

  for (const li of steps) {
    reveal(li);
    await wait(340);
  }

  const result = await factoring;
  factorsEl.innerHTML = factorHtml(N, result.primes, result.leftovers);

  const missed = [...new Set(result.primes.map(String))].map(BigInt).sort(cmp);
  const opener = primes.length ? "" : "An empty list? Bold. ";
  if (missed.length) {
    const marks = missed.slice(0, 3).map((p) => `<span class="missed">${big(p)}</span>`);
    const named = missed.length > 3 ? `${marks.join(", ")} and ${missed.length - 3} more` : listJoin(marks);
    verdictEl.innerHTML = `${opener}You missed ${named}. <strong>The House wins.</strong>`;
    addBtn.textContent = `Add ${fmt(missed[0])} and try again`;
    addBtn.dataset.prime = missed[0].toString();
    show(addBtn);
  } else {
    verdictEl.innerHTML =
      "Every prime factor of that number is missing from your list. The House didn’t work out which ones they are, and it doesn’t have to. <strong>You missed at least one.</strong>";
    hide(addBtn);
  }
  show(verdictBox, whyBtn);
  verdictBox.classList.remove("reveal-in");
  void verdictBox.offsetWidth;
  verdictBox.classList.add("reveal-in");

  renderTally(store.bump("primes.losses"));
  lastRound = { primes, product, N };
  if (!proof.hidden) fillProof();
  busy = false;
  submitBtn.disabled = false;
}

function fillProof() {
  if (!lastRound) return;
  const { primes, product, N } = lastRound;
  pProduct.innerHTML = primes.length ? ` (for your last list, that’s ${big(product)})` : " (for an empty list, that’s 1)";
  pN.innerHTML = ` (for you, ${big(N)})`;
}

/* ---------------- Wiring ---------------- */

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  const parsed = parse(textarea.value);
  if (parsed.error) {
    errorEl.textContent = parsed.error;
    textarea.setAttribute("aria-invalid", "true");
    return;
  }
  errorEl.textContent = "";
  textarea.removeAttribute("aria-invalid");
  noteEl.textContent = parsed.repeats.length
    ? `You listed ${listJoin(parsed.repeats.map((r) => fmt(BigInt(r))))} more than once, so the House counted ${parsed.repeats.length === 1 ? "it" : "each"} once.`
    : NOTE;
  play(parsed.primes);
});

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

textarea.addEventListener("input", () => {
  if (errorEl.textContent) {
    errorEl.textContent = "";
    textarea.removeAttribute("aria-invalid");
  }
});

firstTenBtn.addEventListener("click", () => {
  textarea.value = FIRST_TEN;
  textarea.focus();
});

addBtn.addEventListener("click", () => {
  if (!lastRound || busy) return;
  const next = [...lastRound.primes, BigInt(addBtn.dataset.prime)].sort(cmp);
  textarea.value = next.map(String).join(", ");
  form.requestSubmit();
});

newListBtn.addEventListener("click", () => {
  textarea.value = "";
  noteEl.textContent = NOTE;
  errorEl.textContent = "";
  hide(slip);
  textarea.focus();
});

whyBtn.addEventListener("click", () => {
  fillProof();
  const firstTime = proof.hidden;
  show(proof);
  if (firstTime) proof.classList.add("reveal-in");
  proof.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
});

renderTally();
