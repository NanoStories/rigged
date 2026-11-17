import { Coloring, triangleEdges } from "./ramsey.js";
import { layout, hexPoints, sides, findChain, chainPoints, RED, BLUE } from "./hex.js";
import * as store from "./store.js";
import { svg, reducedMotion, times, word } from "./util.js";

/* ------------------------------------------------------------------ */
/* The wordmark: six letters, fifteen arcs, always a one-color triangle */
/* ------------------------------------------------------------------ */

// A coloring with exactly two one-color triangles, the fewest possible:
// I–G–G in red and G–E–D in blue.
const START = "BBRRRRRBRRRBBBB";

const wordmark = document.getElementById("wordmark");
const lettersGroup = document.getElementById("wordmark-letters");
const heroHouse = document.getElementById("hero-house");

const coloring = new Coloring(6);
let flips = 0;

function arcPath(x1, x2, y, h) {
  // Cubic approximation of a half-ellipse; h > 0 bulges upward.
  const k = (4 / 3) * h;
  return `M ${x1.toFixed(1)} ${y.toFixed(1)} C ${x1.toFixed(1)} ${(y - k).toFixed(1)} ${x2.toFixed(1)} ${(y - k).toFixed(1)} ${x2.toFixed(1)} ${y.toFixed(1)}`;
}

async function buildWordmark() {
  const letters = [...lettersGroup.querySelectorAll("text")];
  try {
    await document.fonts.load('900 250px "Besley"');
  } catch {
    /* fall back to whatever font is available */
  }

  // Lay the letters out with even gaps, sized to fill the width.
  const GAP = 30;
  const SPAN = 1120;
  let size = 250;
  for (const t of letters) t.style.fontSize = `${size}px`;
  let widths = letters.map((t) => t.getComputedTextLength());
  const sum = widths.reduce((a, b) => a + b, 0);
  size = Math.min(290, (size * (SPAN - 5 * GAP)) / sum);
  for (const t of letters) t.style.fontSize = `${size}px`;
  widths = letters.map((t) => t.getComputedTextLength());
  const total = widths.reduce((a, b) => a + b, 0) + 5 * GAP;
  let x = (1200 - total) / 2;
  const centers = widths.map((w) => {
    const c = x + w / 2;
    x += w + GAP;
    return c;
  });

  const baseline = 440;
  letters.forEach((t, i) => {
    t.setAttribute("x", centers[i].toFixed(1));
    t.setAttribute("y", baseline);
    t.style.fontSize = `${size}px`;
  });
  const topY = baseline - 0.75 * size - 24;
  const bottomY = baseline + 26;
  const height = (i, j) => 22 + 36 * (j - i);

  const halos = svg("g", {}, wordmark);
  const arcs = svg("g", {}, wordmark);
  const nodes = svg("g", { "aria-hidden": "true" }, wordmark);
  const hits = svg("g", {}, wordmark);

  for (const cx of centers) {
    svg("circle", { cx, cy: topY, r: 7, class: "node" }, nodes);
    svg("circle", { cx, cy: bottomY, r: 7, class: "node" }, nodes);
  }

  const names = "RIGGED".split("");
  const refs = [];
  coloring.pairs().forEach(([i, j], k) => {
    const color = START[k] === "R" ? "red" : "blue";
    coloring.set(i, j, color);
    const ref = {
      i,
      j,
      x1: centers[i],
      x2: centers[j],
      h: height(i, j),
      t: color === "red" ? 0 : 1, // 0 = above, 1 = below
      anim: null,
    };
    ref.halo = svg("path", { class: "arc-halo" }, halos);
    ref.arc = svg("path", { class: `arc ${color}` }, arcs);
    ref.hit = svg(
      "path",
      {
        class: "arc-hit",
        tabindex: 0,
        role: "button",
        "aria-label": `Arc joining ${names[i]} and ${names[j]}`,
      },
      hits,
    );
    ref.hit.addEventListener("click", () => flip(ref));
    ref.hit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        flip(ref);
      }
    });
    ref.hit.addEventListener("focus", () => {
      if (ref.hit.matches(":focus-visible")) ref.arc.classList.add("focus");
    });
    ref.hit.addEventListener("blur", () => ref.arc.classList.remove("focus"));
    ref.draw = () => {
      const y = topY + (bottomY - topY) * ref.t;
      const d = arcPath(ref.x1, ref.x2, y, ref.h * (1 - 2 * ref.t));
      ref.arc.setAttribute("d", d);
      ref.halo.setAttribute("d", d);
      ref.hit.setAttribute("d", d);
    };
    ref.draw();
    refs.push(ref);
  });

  function flip(ref) {
    const next = coloring.get(ref.i, ref.j) === "red" ? "blue" : "red";
    coloring.set(ref.i, ref.j, next);
    flips += 1;
    const from = ref.t;
    const to = next === "red" ? 0 : 1;
    cancelAnimationFrame(ref.anim);
    const duration = reducedMotion() ? 0 : 420;
    const start = performance.now();
    const step = (now) => {
      const p = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      ref.t = from + (to - from) * eased;
      ref.draw();
      // Swap the color as the arc passes through the letters.
      const showing = ref.t < 0.5 ? "red" : "blue";
      ref.arc.classList.toggle("red", showing === "red");
      ref.arc.classList.toggle("blue", showing === "blue");
      if (p < 1) ref.anim = requestAnimationFrame(step);
    };
    ref.anim = requestAnimationFrame(step);
    mark();
  }

  function mark() {
    const tris = coloring.triangles();
    const lit = new Set(tris.flatMap((t) => triangleEdges(t.verts).map(([a, b]) => Coloring.key(a, b))));
    for (const ref of refs) {
      ref.halo.classList.toggle("on", lit.has(Coloring.key(ref.i, ref.j)));
      const color = coloring.get(ref.i, ref.j);
      ref.hit.setAttribute("aria-label", `Arc joining ${names[ref.i]} and ${names[ref.j]}, ${color}`);
    }
    const n = tris.length;
    let line;
    if (flips === 0) line = `Right now there are ${word(n)}.`;
    else if (n === 2 && flips >= 3) line = "Two. It never gets lower than that.";
    else line = `${word(n)[0].toUpperCase()}${word(n).slice(1)} one-color triangles now.`;
    heroHouse.textContent = line;
  }

  // One orchestrated moment on arrival: the arcs draw themselves in,
  // then the House marks the triangles.
  if (!reducedMotion()) {
    refs.forEach((ref, k) => {
      const length = ref.arc.getTotalLength();
      ref.arc.style.strokeDasharray = `${length}`;
      ref.arc.style.strokeDashoffset = `${length}`;
      ref.arc.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
        duration: 520,
        delay: 120 + k * 55,
        easing: "cubic-bezier(.3,.7,.3,1)",
        fill: "forwards",
      }).onfinish = () => {
        ref.arc.style.strokeDasharray = "";
        ref.arc.style.strokeDashoffset = "";
      };
    });
    setTimeout(mark, 120 + refs.length * 55 + 450);
  } else {
    mark();
  }
}

/* ------------------------------------------------------------------ */
/* Small pictures for each table                                       */
/* ------------------------------------------------------------------ */

function drawSixDotsArt(root) {
  const c = new Coloring(6);
  c.pairs().forEach(([i, j], k) => c.set(i, j, START[k] === "R" ? "red" : "blue"));
  const pos = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [60 + 46 * Math.cos(a), 60 + 46 * Math.sin(a)];
  });
  const lit = new Set(triangleEdges([1, 2, 3]).map(([a, b]) => Coloring.key(a, b)));
  const halo = svg("g", {}, root);
  const lines = svg("g", {}, root);
  for (const [i, j] of c.pairs()) {
    const [x1, y1] = pos[i];
    const [x2, y2] = pos[j];
    if (lit.has(Coloring.key(i, j))) {
      svg("line", { x1, y1, x2, y2, stroke: "var(--gold)", "stroke-width": 9, "stroke-linecap": "round" }, halo);
    }
    svg(
      "line",
      {
        x1,
        y1,
        x2,
        y2,
        stroke: c.get(i, j) === "red" ? "var(--red)" : "var(--blue)",
        "stroke-width": 3,
        "stroke-linecap": "round",
      },
      lines,
    );
  }
  for (const [cx, cy] of pos) {
    svg("circle", { cx, cy, r: 5.5, fill: "var(--ink)", stroke: "var(--paper)", "stroke-width": 2 }, root);
  }
}

function drawPrimeArt(root) {
  svg(
    "rect",
    { x: 12, y: 6, width: 96, height: 108, rx: 4, fill: "var(--paper-raised)", stroke: "var(--ink)", "stroke-width": 2 },
    root,
  );
  const text = (y, content, extra = {}) =>
    svg(
      "text",
      {
        x: 22,
        y,
        "font-family": "Besley, Georgia, serif",
        "font-weight": 700,
        "font-size": 13,
        fill: "var(--ink)",
        ...extra,
      },
      root,
    ).append(content);
  svg("rect", { x: 21, y: 80, width: 20, height: 9, fill: "var(--gold)" }, root);
  text(30, "2×3×5×7");
  text(48, "×11×13");
  text(66, "+1");
  text(88, "59 × 509", { "font-size": 15 });
  svg("line", { x1: 22, y1: 100, x2: 98, y2: 100, stroke: "var(--rule)", "stroke-dasharray": "3 3" }, root);
}

function drawHexArt(root) {
  const n = 5;
  const pattern = "BRBBRRRBRBBRRBBBBRRBRBRBB";
  const cells = [...pattern].map((ch) => (ch === "R" ? RED : BLUE));
  const geo = layout(n, 9.2, 7);
  root.setAttribute("viewBox", `0 0 ${geo.width.toFixed(1)} ${geo.height.toFixed(1)}`);
  const s = sides(geo);
  const bands = svg("g", { fill: "none", "stroke-width": 5, "stroke-linejoin": "round", "stroke-linecap": "round" }, root);
  svg("polyline", { points: s.top, stroke: "var(--red)" }, bands);
  svg("polyline", { points: s.bottom, stroke: "var(--red)" }, bands);
  svg("polyline", { points: s.left, stroke: "var(--blue)" }, bands);
  svg("polyline", { points: s.right, stroke: "var(--blue)" }, bands);
  cells.forEach((v, idx) => {
    const [cx, cy] = geo.center(Math.floor(idx / n), idx % n);
    svg(
      "polygon",
      {
        points: hexPoints(cx, cy, 9.2),
        fill: v === RED ? "var(--red)" : "var(--blue)",
        stroke: "var(--paper)",
        "stroke-width": 1.6,
      },
      root,
    );
  });
  for (const color of [RED, BLUE]) {
    const path = findChain(cells, n, color);
    if (!path) continue;
    const points = chainPoints(geo, path, color);
    svg("polyline", { points, fill: "none", stroke: "var(--ink)", "stroke-width": 5.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, root);
    svg("polyline", { points, fill: "none", stroke: "var(--gold)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, root);
  }
}

/* ------------------------------------------------------------------ */
/* Your record at each table                                           */
/* ------------------------------------------------------------------ */

const RECORDS = {
  sixdots: { key: "sixdots.losses", rival: "Ramsey’s theorem" },
  primes: { key: "primes.losses", rival: "Euclid" },
  hex: { key: "hex.losses", rival: "the Hex theorem" },
};

function showRecords() {
  for (const node of document.querySelectorAll("[data-record]")) {
    const { key, rival } = RECORDS[node.dataset.record];
    const losses = Number(store.get(key, 0)) || 0;
    node.textContent = losses ? `You’ve lost ${times(losses)} to ${rival}.` : "You haven’t lost here yet.";
  }
}

if (window.matchMedia("(pointer: coarse)").matches) {
  document.getElementById("hero-verb").textContent = "Tap";
}
drawSixDotsArt(document.getElementById("art-six-dots"));
drawPrimeArt(document.getElementById("art-every-prime"));
drawHexArt(document.getElementById("art-nobody-wins"));
showRecords();
window.addEventListener("pageshow", showRecords);
buildWordmark();
