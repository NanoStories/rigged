import { Coloring, other, triangleEdges } from "../assets/js/ramsey.js";
import * as store from "../assets/js/store.js";
import { svg, show, hide, times, word, listJoin } from "../assets/js/util.js";

const $ = (id) => document.getElementById(id);
const board = $("board");
const houseEl = $("house");
const statusEl = $("status");
const tallyEl = $("tally");
const addDotBtn = $("add-dot");
const whyBtn = $("why");
const clearBtn = $("clear");
const skipBtn = $("skip");
const hintBtn = $("hint-btn");
const hintEl = $("hint");
const giveUpBtn = $("give-up");
const playPanel = $("play-panel");
const proofPanel = $("proof-panel");
const stepCountEl = $("step-count");
const stepTextEl = $("step-text");
const nextBtn = $("next");
const backBtn = $("back");
const againBtn = $("again");
const notesEl = $("notes");

const CENTER = 300;
const RADIUS = 226;
const LETTERS = ["A", "B", "C"];
const STEPS = 5;
const VERB = window.matchMedia("(pointer: coarse)").matches ? "Tap" : "Click";

const state = {
  n: store.get("sixdots.warmupDone", false) ? 6 : 5,
  coloring: null,
  wasFull: false,
  changes: 0,
  mode: "play",
  proof: null,
  step: 0,
};
let refs = null;

const sw = (color) => `<span class="swatch ${color}">${color}</span>`;
const say = (html) => {
  houseEl.innerHTML = html;
};

/* ---------------- Board ---------------- */

function positions(n) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [CENTER + RADIUS * Math.cos(a), CENTER + RADIUS * Math.sin(a)];
  });
}

function build(n, newDot = false) {
  board.replaceChildren();
  const pos = positions(n);
  const gHalo = svg("g", {}, board);
  const gEdge = svg("g", {}, board);
  const gRing = svg("g", { "aria-hidden": "true" }, board);
  const gHit = svg("g", {}, board);
  const gDot = svg("g", { "aria-hidden": "true" }, board);
  const gLabel = svg("g", { "aria-hidden": "true" }, board);
  refs = { edges: new Map(), rings: [], labels: [] };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [x1, y1] = pos[i];
      const [x2, y2] = pos[j];
      const a = { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) };
      const ref = { i, j };
      ref.halo = svg("line", { ...a, class: "edge-halo" }, gHalo);
      ref.line = svg("line", { ...a, class: "edge" }, gEdge);
      ref.hit = svg("line", { ...a, class: "edge-hit", tabindex: 0, role: "button" }, gHit);
      ref.hit.addEventListener("click", () => cycle(ref));
      ref.hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          cycle(ref);
        }
      });
      const on = () => ref.line.classList.add("hover");
      const off = () => ref.line.classList.remove("hover");
      ref.hit.addEventListener("pointerenter", on);
      ref.hit.addEventListener("pointerleave", off);
      ref.hit.addEventListener("focus", () => {
        if (ref.hit.matches(":focus-visible")) on();
      });
      ref.hit.addEventListener("blur", off);
      refs.edges.set(Coloring.key(i, j), ref);
    }
  }

  pos.forEach(([x, y], i) => {
    refs.rings.push(svg("circle", { cx: x, cy: y, r: 26, class: "dot-ring" }, gRing));
    svg("circle", { cx: x, cy: y, r: 14, class: newDot && i === n - 1 ? "dot new" : "dot" }, gDot);
    const dx = x - CENTER;
    const dy = y - CENTER;
    const d = Math.hypot(dx, dy);
    refs.labels.push(
      svg(
        "text",
        {
          x: (x + (dx / d) * 48).toFixed(1),
          y: (y + (dy / d) * 48 + 11).toFixed(1),
          "text-anchor": "middle",
          class: "dot-label",
        },
        gLabel,
      ),
    );
  });
}

function paint() {
  const col = state.coloring;
  const tris = col.triangles();
  const lit = new Set(tris.flatMap((t) => triangleEdges(t.verts).map(([a, b]) => Coloring.key(a, b))));
  for (const [key, ref] of refs.edges) {
    const c = col.get(ref.i, ref.j);
    ref.line.classList.toggle("red", c === "red");
    ref.line.classList.toggle("blue", c === "blue");
    ref.halo.classList.toggle("on", lit.has(key));
    ref.hit.setAttribute("aria-label", `Line from dot ${ref.i + 1} to dot ${ref.j + 1}, ${c ?? "not colored"}`);
  }
  return tris;
}

/* ---------------- Playing ---------------- */

function cycle(ref) {
  if (state.mode !== "play") return;
  const current = state.coloring.get(ref.i, ref.j);
  const next = current === null ? "red" : current === "red" ? "blue" : null;
  state.coloring.set(ref.i, ref.j, next);
  state.changes += 1;
  update();
}

function describe(tris) {
  const reds = tris.filter((t) => t.color === "red").length;
  const blues = tris.length - reds;
  const part = (k, color) => (k === 1 ? `a ${sw(color)} triangle` : `${word(k)} ${sw(color)} triangles`);
  const parts = [];
  if (reds) parts.push(part(reds, "red"));
  if (blues) parts.push(part(blues, "blue"));
  return listJoin(parts);
}

function intro() {
  if (state.n === 5) {
    return `Warm-up first: five dots and ten lines. ${VERB} a line to make it red, again for blue, and once more to clear it.`;
  }
  return `Six dots and fifteen lines, same rule. ${VERB} a line to make it red, again for blue, and once more to clear it.`;
}

function trapped() {
  const [[i, j]] = state.coloring.empties();
  const makesTriangle = (color) => {
    const copy = state.coloring.clone();
    copy.set(i, j, color);
    return copy.triangles().length > 0;
  };
  return makesTriangle("red") && makesTriangle("blue");
}

function update() {
  const col = state.coloring;
  const tris = paint();
  const full = col.isFull();
  const warmup = state.n === 5;
  statusEl.textContent = `${col.size} of ${col.total} lines colored.`;
  hide(addDotBtn, whyBtn);

  if (warmup) {
    hide(giveUpBtn);
    show(skipBtn);
    hintBtn.hidden = !hintEl.hidden || state.changes < 16;
    if (full && tris.length === 0) {
      store.set("sixdots.warmupDone", true);
      say("Not a single one-color triangle. <strong>You win this one.</strong> Now the House would like to add one more dot.");
      show(addDotBtn);
      hide(skipBtn, hintBtn, hintEl);
      state.wasFull = true;
      return;
    }
  } else {
    hide(skipBtn, hintBtn, hintEl);
  }

  if (full && !warmup) {
    if (!state.wasFull) renderTally(store.bump("sixdots.losses"));
    say(`Every line is colored, and the board has ${describe(tris)}. <strong>The House wins.</strong>`);
    show(whyBtn);
    hide(giveUpBtn);
  } else {
    if (tris.length === 1) say(`That’s ${describe(tris)}. Recolor one of its lines.`);
    else if (tris.length > 1) say(`That’s ${describe(tris)}. Break them up.`);
    else if (col.size === 0) say(intro());
    else if (col.total - col.size === 1 && trapped()) say("One line left. Red makes a one-color triangle, and so does blue.");
    else say(warmup ? "No one-color triangles so far." : "No one-color triangles yet. So far, so good.");
    if (!warmup) giveUpBtn.hidden = state.changes < 5;
  }
  state.wasFull = full;
}

function renderTally(losses = Number(store.get("sixdots.losses", 0)) || 0) {
  tallyEl.textContent = losses ? `You’ve lost here ${times(losses)}.` : "";
}

function reset() {
  state.coloring = new Coloring(state.n);
  state.wasFull = false;
  update();
}

function goToSix() {
  state.n = 6;
  state.changes = 0;
  build(6, true);
  reset();
}

/* ---------------- The proof ---------------- */

function plan(col) {
  let pick = null;
  for (let v = 0; v < col.n; v++) {
    const by = { red: [], blue: [] };
    for (let u = 0; u < col.n; u++) if (u !== v) by[col.get(v, u)].push(u);
    const color = by.red.length >= 3 ? "red" : "blue";
    const candidate = { v, color, count: by[color].length, ends: by[color].slice(0, 3) };
    if (!pick || (candidate.count === 3 && pick.count !== 3)) pick = candidate;
    if (pick.count === 3) break;
  }
  const [a, b, c] = pick.ends;
  const inner = [
    [a, b],
    [b, c],
    [a, c],
  ];
  const closing = inner.find(([x, y]) => col.get(x, y) === pick.color) || null;
  return {
    ...pick,
    inner,
    closing,
    triangle: closing ? [pick.v, closing[0], closing[1]] : [a, b, c],
  };
}

function startProof() {
  if (state.n !== 6) return;
  let filled = false;
  if (!state.coloring.isFull()) {
    for (const [i, j] of state.coloring.empties()) state.coloring.set(i, j, Math.random() < 0.5 ? "red" : "blue");
    filled = true;
    update();
  }
  state.proof = { ...plan(state.coloring), filled };
  state.mode = "proof";
  board.classList.add("locked");
  for (const ref of refs.edges.values()) ref.hit.setAttribute("tabindex", "-1");
  hide(playPanel);
  show(proofPanel);
  state.step = 0;
  renderStep();
  nextBtn.focus();
}

function renderStep() {
  const p = state.proof;
  const s = state.step;
  const key = Coloring.key;
  const name = (x) => LETTERS[p.ends.indexOf(x)];
  const keep = new Set();
  const halo = new Set();
  const rings = new Set();
  const labels = new Set();
  let text;

  if (s === 0) {
    rings.add(p.v);
    text = `${p.filled ? "The House colored your empty lines at random. " : ""}Pick any dot at all. The House picks this one.`;
  } else if (s === 1) {
    rings.add(p.v);
    for (let u = 0; u < 6; u++) if (u !== p.v) keep.add(key(p.v, u));
    for (const e of p.ends) {
      halo.add(key(p.v, e));
      labels.add(e);
    }
    text = `Five lines come out of it and there are only two colors, so at least three of them must match. Here ${word(p.count)} are ${sw(p.color)}. Call the far ends of three of them A, B and C.`;
  } else if (s === 2) {
    rings.add(p.v);
    for (const e of p.ends) {
      keep.add(key(p.v, e));
      labels.add(e);
    }
    for (const [x, y] of p.inner) {
      keep.add(key(x, y));
      halo.add(key(x, y));
    }
    text = `Now look at the three lines joining A, B and C to each other. Each one is either ${sw(p.color)} or ${sw(other(p.color))}.`;
  } else if (s === 3) {
    for (const e of p.ends) labels.add(e);
    for (const [x, y] of triangleEdges(p.triangle)) {
      keep.add(key(x, y));
      halo.add(key(x, y));
    }
    if (p.closing) {
      rings.add(p.v);
      const [x, y] = p.closing;
      text = `The line from ${name(x)} to ${name(y)} is ${sw(p.color)}, so it closes a ${sw(p.color)} triangle with the first dot. If none of the three had been ${sw(p.color)}, they’d all be ${sw(other(p.color))}, and A, B and C would make a ${sw(other(p.color))} triangle instead.`;
    } else {
      text = `None of them is ${sw(p.color)}, so all three are ${sw(other(p.color))}, and A, B and C make a ${sw(other(p.color))} triangle. If any of them had been ${sw(p.color)}, it would have closed a ${sw(p.color)} triangle with the first dot instead.`;
    }
  } else {
    const all = state.coloring.triangles();
    for (const t of all) for (const [x, y] of triangleEdges(t.verts)) halo.add(key(x, y));
    text = `Either way, there’s a triangle. The argument works on every possible coloring, so the House never needs to look at your board. (Yours has ${word(all.length)}.) With five dots it falls apart at the second step: each dot has only four lines, and two of each color is allowed.`;
  }

  board.classList.toggle("dim", s < STEPS - 1);
  for (const [k, ref] of refs.edges) {
    ref.line.classList.toggle("keep", keep.has(k));
    ref.halo.classList.toggle("on", halo.has(k));
  }
  refs.rings.forEach((ring, i) => ring.classList.toggle("on", rings.has(i)));
  refs.labels.forEach((label, i) => {
    const on = labels.has(i);
    if (on) label.textContent = name(i);
    label.classList.toggle("on", on);
  });

  stepCountEl.textContent = `Step ${s + 1} of ${STEPS}`;
  stepTextEl.innerHTML = text;
  backBtn.hidden = s === 0;
  nextBtn.hidden = s === STEPS - 1;
  againBtn.hidden = s !== STEPS - 1;
  if (s === STEPS - 1 && notesEl.hidden) {
    show(notesEl);
    notesEl.classList.add("reveal-in");
  }
}

function playAgain() {
  state.mode = "play";
  board.classList.remove("locked", "dim");
  for (const ref of refs.edges.values()) {
    ref.hit.setAttribute("tabindex", "0");
    ref.line.classList.remove("keep");
  }
  refs.rings.forEach((ring) => ring.classList.remove("on"));
  refs.labels.forEach((label) => label.classList.remove("on"));
  hide(proofPanel);
  show(playPanel);
  reset();
  clearBtn.focus();
}

/* ---------------- Wiring ---------------- */

clearBtn.addEventListener("click", reset);
skipBtn.addEventListener("click", () => {
  store.set("sixdots.warmupDone", true);
  goToSix();
});
addDotBtn.addEventListener("click", goToSix);
hintBtn.addEventListener("click", () => {
  show(hintEl);
  hide(hintBtn);
});
whyBtn.addEventListener("click", startProof);
giveUpBtn.addEventListener("click", startProof);
nextBtn.addEventListener("click", () => {
  state.step = Math.min(STEPS - 1, state.step + 1);
  renderStep();
  if (state.step === STEPS - 1) againBtn.focus();
});
backBtn.addEventListener("click", () => {
  state.step = Math.max(0, state.step - 1);
  renderStep();
  if (state.step === 0) nextBtn.focus();
});
againBtn.addEventListener("click", playAgain);

build(state.n);
reset();
renderTally();
