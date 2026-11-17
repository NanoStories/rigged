import {
  layout,
  hexPoints,
  sides,
  findChain,
  floodFromTop,
  waterline,
  chainPoints,
  EMPTY,
  RED,
  BLUE,
} from "../assets/js/hex.js";
import * as store from "../assets/js/store.js";
import { svg, show, hide, times, wait } from "../assets/js/util.js";

const $ = (id) => document.getElementById(id);
const board = $("board");
const houseEl = $("house");
const statusEl = $("status");
const tallyEl = $("tally");
const whyBtn = $("why");
const randomBtn = $("random");
const clearBtn = $("clear");
const giveUpBtn = $("give-up");
const playPanel = $("play-panel");
const proofPanel = $("proof-panel");
const stepCountEl = $("step-count");
const stepTextEl = $("step-text");
const nextBtn = $("next");
const backBtn = $("back");
const againBtn = $("again");
const notesEl = $("notes");
const brushButtons = [...document.querySelectorAll("[data-brush]")];

const N = 7;
const SIZE = 30;
const geo = layout(N, SIZE, 24);
const VERB = window.matchMedia("(pointer: coarse)").matches ? "tap" : "click";

const state = {
  cells: new Array(N * N).fill(EMPTY),
  brush: RED,
  cursor: Math.floor((N * N) / 2),
  wasFull: false,
  changes: 0,
  mode: "play",
  painting: false,
  proof: null,
  step: 0,
  token: 0,
};

const say = (html) => {
  houseEl.innerHTML = html;
};

/* ---------------- Board ---------------- */

const refs = { cells: [], wet: [], marks: [] };
let chainLayer;
let cursorEl;

function build() {
  board.setAttribute("viewBox", `0 0 ${geo.width.toFixed(1)} ${geo.height.toFixed(1)}`);
  const defs = svg("defs", {}, board);
  const pattern = svg(
    "pattern",
    { id: "wet", width: 9, height: 9, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-35)" },
    defs,
  );
  svg("rect", { width: 9, height: 9, fill: "#e8573f" }, pattern);
  svg("rect", { width: 9, height: 3.2, fill: "#f7f7f3", opacity: 0.85 }, pattern);

  const outline = sides(geo);
  const bands = svg("g", { "aria-hidden": "true" }, board);
  svg("polyline", { points: outline.top, class: "band red" }, bands);
  svg("polyline", { points: outline.bottom, class: "band red" }, bands);
  svg("polyline", { points: outline.left, class: "band blue" }, bands);
  svg("polyline", { points: outline.right, class: "band blue" }, bands);

  const cells = svg("g", {}, board);
  const wet = svg("g", { "aria-hidden": "true" }, board);
  const marks = svg("g", { "aria-hidden": "true" }, board);
  for (let idx = 0; idx < N * N; idx++) {
    const [cx, cy] = geo.center(Math.floor(idx / N), idx % N);
    refs.cells.push(svg("polygon", { points: hexPoints(cx, cy, SIZE), class: "cell", "data-idx": idx }, cells));
    refs.wet.push(svg("polygon", { points: hexPoints(cx, cy, SIZE - 1.5), class: "cell-wet", fill: "url(#wet)" }, wet));
    refs.marks.push(svg("polygon", { points: hexPoints(cx, cy, SIZE - 5), class: "cell-mark" }, marks));
  }
  chainLayer = svg("g", { "aria-hidden": "true", "pointer-events": "none" }, board);
  cursorEl = svg("polygon", { class: "cursor", "aria-hidden": "true" }, board);
  moveCursor();
}

function renderCells() {
  state.cells.forEach((v, idx) => {
    const cell = refs.cells[idx];
    const wasEmpty = !cell.classList.contains("red") && !cell.classList.contains("blue");
    cell.classList.toggle("red", v === RED);
    cell.classList.toggle("blue", v === BLUE);
    // Painted cells sit above empty ones so the empty cells' grid lines never cut into them.
    if (wasEmpty && v !== EMPTY) cell.parentNode.appendChild(cell);
  });
}

function drawChains(chains) {
  chainLayer.replaceChildren();
  for (const [path, color] of chains) {
    if (!path) continue;
    const points = chainPoints(geo, path, color);
    svg("polyline", { points, class: "chain-under" }, chainLayer);
    svg("polyline", { points, class: "chain" }, chainLayer);
  }
}

function moveCursor() {
  const [cx, cy] = geo.center(Math.floor(state.cursor / N), state.cursor % N);
  cursorEl.setAttribute("points", hexPoints(cx, cy, SIZE - 4));
}

/* ---------------- Playing ---------------- */

function paintCell(idx) {
  if (state.mode !== "play" || state.cells[idx] === state.brush) return;
  state.cells[idx] = state.brush;
  state.changes += 1;
  update();
}

function cellAt(x, y) {
  const hit = document.elementFromPoint(x, y)?.closest?.("[data-idx]");
  return hit && board.contains(hit) ? Number(hit.dataset.idx) : null;
}

function renderTally(losses = Number(store.get("hex.losses", 0)) || 0) {
  tallyEl.textContent = losses ? `You’ve lost here ${times(losses)}.` : "";
}

function update() {
  renderCells();
  const red = findChain(state.cells, N, RED);
  const blue = findChain(state.cells, N, BLUE);
  drawChains([
    [red, RED],
    [blue, BLUE],
  ]);
  const empty = state.cells.filter((v) => v === EMPTY).length;
  const full = empty === 0;
  statusEl.textContent = full ? "" : `${empty} empty ${empty === 1 ? "cell" : "cells"} left.`;
  hide(whyBtn);

  if (full) {
    if (!state.wasFull) renderTally(store.bump("hex.losses"));
    const who = red
      ? `<span class="red">red</span> got through from top to bottom`
      : `<span class="blue">blue</span> got through from left to right`;
    say(`The board is full, and ${who}. <strong>The House wins.</strong>`);
    show(whyBtn);
    hide(giveUpBtn);
  } else {
    if (red) say(`<span class="red">Red</span> already connects top to bottom. Break the chain somewhere.`);
    else if (blue) say(`<span class="blue">Blue</span> already connects left to right. Break the chain somewhere.`);
    else if (empty === N * N) {
      say(
        `Pick a color, then ${VERB} or drag across cells to paint them. Red joins the top and bottom edges; blue joins left and right.`,
      );
    } else say("Nobody connects yet. So far, so good.");
    giveUpBtn.hidden = state.changes < 8;
  }
  state.wasFull = full;
}

function setBrush(value) {
  state.brush = value;
  for (const button of brushButtons) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.brush) === value));
  }
}

function fillRandom() {
  state.cells = state.cells.map((v) => (v === EMPTY ? (Math.random() < 0.5 ? RED : BLUE) : v));
  state.changes += 1;
  update();
}

function clearBoard() {
  state.cells = new Array(N * N).fill(EMPTY);
  state.wasFull = false;
  update();
}

/* ---------------- The proof ---------------- */

function startProof() {
  let filled = false;
  if (state.cells.includes(EMPTY)) {
    fillRandom();
    filled = true;
  }
  const { layers, wet } = floodFromTop(state.cells, N);
  const through = [...wet].some((idx) => Math.floor(idx / N) === N - 1);
  const proof = { filled, layers, wet, through };
  if (through) {
    proof.chain = findChain(state.cells, N, RED, wet);
    proof.color = RED;
    proof.steps = ["pour", "through", "either"];
  } else {
    proof.edge = waterline(state.cells, N, wet);
    proof.chain = findChain(state.cells, N, BLUE, proof.edge) || findChain(state.cells, N, BLUE);
    proof.color = BLUE;
    proof.steps = ["pour", "stopped", "wall", "either"];
  }
  state.proof = proof;
  state.mode = "proof";
  board.classList.add("locked");
  drawChains([]);
  hide(playPanel);
  show(proofPanel);
  state.step = 0;
  renderStep(true);
  nextBtn.focus();
}

function setWet(on) {
  refs.wet.forEach((node, idx) => node.classList.toggle("on", on && state.proof.wet.has(idx)));
}

function setMarks(on) {
  refs.marks.forEach((node, idx) => node.classList.toggle("on", on && !!state.proof.edge?.has(idx)));
}

async function renderStep(animate = false) {
  const token = ++state.token;
  const p = state.proof;
  const kind = p.steps[state.step];
  const total = p.steps.length;
  let text;

  setMarks(false);
  drawChains([]);

  if (kind === "pour") {
    text = `${p.filled ? "The House filled your empty cells at random. " : ""}Imagine pouring water along the top edge. It can only soak into red cells, spreading from each one to its red neighbors.`;
  } else if (kind === "through") {
    text = "It reaches the bottom edge. The wet cells hold a red path from top to bottom, so red wins.";
  } else if (kind === "stopped") {
    text = p.layers.length
      ? "It stops short of the bottom. Look at the cells along the water’s edge: every one of them is blue. A red one would have let the water through."
      : "It goes nowhere: the whole top row is blue. That row is where the water stops.";
  } else if (kind === "wall") {
    text =
      "Those blue cells link up into a wall running from the left edge to the right edge. They have to, or the water would leak around the end. That wall is a blue chain, so blue wins.";
  } else {
    text =
      "Either the water gets through or a wall holds it back. There’s no third option, so on a full board somebody always wins. And never both: a red path from top to bottom and a blue path from left to right would have to cross, and they can’t share a cell.";
  }

  stepCountEl.textContent = `Step ${state.step + 1} of ${total}`;
  stepTextEl.textContent = text;
  backBtn.hidden = state.step === 0;
  nextBtn.hidden = state.step === total - 1;
  againBtn.hidden = state.step !== total - 1;
  if (state.step === total - 1 && notesEl.hidden) {
    show(notesEl);
    notesEl.classList.add("reveal-in");
  }

  if (kind === "pour" && animate) {
    setWet(false);
    for (const layer of p.layers) {
      await wait(130);
      if (token !== state.token) return;
      for (const idx of layer) refs.wet[idx].classList.add("on");
    }
    return;
  }
  setWet(true);
  if (kind === "stopped" || kind === "wall") setMarks(true);
  if (kind === "through" || kind === "wall" || kind === "either") drawChains([[p.chain, p.color]]);
}

function playAgain() {
  state.token += 1;
  state.mode = "play";
  board.classList.remove("locked");
  setWet(false);
  setMarks(false);
  hide(proofPanel);
  show(playPanel);
  clearBoard();
  clearBtn.focus();
}

/* ---------------- Wiring ---------------- */

board.addEventListener("pointerdown", (event) => {
  if (state.mode !== "play" || event.button > 0) return;
  const idx = cellAt(event.clientX, event.clientY);
  if (idx === null) return;
  event.preventDefault();
  state.painting = true;
  board.setPointerCapture?.(event.pointerId);
  state.cursor = idx;
  moveCursor();
  paintCell(idx);
});
board.addEventListener("pointermove", (event) => {
  if (!state.painting) return;
  const idx = cellAt(event.clientX, event.clientY);
  if (idx !== null) paintCell(idx);
});
const stopPainting = () => {
  state.painting = false;
};
board.addEventListener("pointerup", stopPainting);
board.addEventListener("pointercancel", stopPainting);

board.addEventListener("keydown", (event) => {
  if (state.mode !== "play") return;
  const r = Math.floor(state.cursor / N);
  const c = state.cursor % N;
  let nr = r;
  let nc = c;
  switch (event.key) {
    case "ArrowUp":
      nr -= 1;
      break;
    case "ArrowDown":
      nr += 1;
      break;
    case "ArrowLeft":
      nc -= 1;
      break;
    case "ArrowRight":
      nc += 1;
      break;
    case " ":
    case "Enter":
      event.preventDefault();
      paintCell(state.cursor);
      return;
    case "r":
    case "R":
      setBrush(RED);
      return;
    case "b":
    case "B":
      setBrush(BLUE);
      return;
    case "e":
    case "E":
      setBrush(EMPTY);
      return;
    default:
      return;
  }
  event.preventDefault();
  if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
    state.cursor = nr * N + nc;
    moveCursor();
  }
});

for (const button of brushButtons) {
  button.addEventListener("click", () => setBrush(Number(button.dataset.brush)));
}
randomBtn.addEventListener("click", fillRandom);
clearBtn.addEventListener("click", clearBoard);
whyBtn.addEventListener("click", startProof);
giveUpBtn.addEventListener("click", startProof);
nextBtn.addEventListener("click", () => {
  state.step = Math.min(state.proof.steps.length - 1, state.step + 1);
  renderStep(false);
  if (state.step === state.proof.steps.length - 1) againBtn.focus();
});
backBtn.addEventListener("click", () => {
  state.step = Math.max(0, state.step - 1);
  renderStep(false);
  if (state.step === 0) nextBtn.focus();
});
againBtn.addEventListener("click", playAgain);

build();
update();
renderTally();
