// Geometry and connectivity for an n x n Hex board (rhombus of pointy-top
// hexagons, each row shifted half a cell to the right of the one above).
// Red joins top to bottom; blue joins left to right.

export const EMPTY = 0;
export const RED = 1;
export const BLUE = 2;

const SQRT3 = Math.sqrt(3);

export function layout(n, size, margin) {
  const w = SQRT3 * size;
  const ox = margin + w / 2;
  const oy = margin + size;
  return {
    n,
    size,
    w,
    width: 2 * margin + w * (1.5 * n - 0.5),
    height: 2 * margin + size * (1.5 * n + 0.5),
    center(r, c) {
      return [ox + c * w + (r * w) / 2, oy + r * 1.5 * size];
    },
  };
}

/** Corner k of a pointy-top hexagon: 0 upper-right, 1 lower-right,
 *  2 bottom, 3 lower-left, 4 upper-left, 5 top. */
export function corner(cx, cy, radius, k) {
  const angle = (Math.PI / 180) * (60 * k - 30);
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

export function hexPoints(cx, cy, radius) {
  const pts = [];
  for (let k = 0; k < 6; k++) pts.push(corner(cx, cy, radius, k).map((v) => v.toFixed(2)).join(","));
  return pts.join(" ");
}

/** Polylines tracing the four sides of the board, for the colored bands. */
export function sides(geo) {
  const { n, size } = geo;
  const at = (r, c, k) => corner(...geo.center(r, c), size, k);
  const top = [at(0, 0, 4)];
  const bottom = [at(n - 1, 0, 3)];
  const left = [];
  const right = [at(0, n - 1, 0)];
  for (let c = 0; c < n; c++) {
    top.push(at(0, c, 5), at(0, c, 0));
    bottom.push(at(n - 1, c, 2), at(n - 1, c, 1));
  }
  for (let r = 0; r < n; r++) {
    left.push(at(r, 0, 4), at(r, 0, 3));
    if (r < n - 1) left.push(at(r, 0, 2));
    if (r > 0) right.push(at(r, n - 1, 0));
    right.push(at(r, n - 1, 1));
  }
  const str = (pts) => pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" ");
  return { top: str(top), bottom: str(bottom), left: str(left), right: str(right) };
}

export function neighbors(n, idx) {
  const r = Math.floor(idx / n);
  const c = idx % n;
  const out = [];
  const steps = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  for (const [dr, dc] of steps) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
  }
  return out;
}

/** Cells on the side a color starts from, and the test for the side it must reach. */
function ends(n, color) {
  const start = [];
  for (let i = 0; i < n; i++) start.push(color === RED ? i : i * n);
  const isGoal = color === RED ? (idx) => Math.floor(idx / n) === n - 1 : (idx) => idx % n === n - 1;
  return { start, isGoal };
}

/** Shortest chain of `color` joining its two sides, or null.
 *  `allowed` optionally restricts which cells the chain may use. */
export function findChain(cells, n, color, allowed = null) {
  const { start, isGoal } = ends(n, color);
  const ok = (idx) => cells[idx] === color && (!allowed || allowed.has(idx));
  const parent = new Map();
  const queue = [];
  for (const idx of start) {
    if (ok(idx)) {
      parent.set(idx, -1);
      queue.push(idx);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    if (isGoal(idx)) {
      const path = [];
      for (let at = idx; at !== -1; at = parent.get(at)) path.push(at);
      return path.reverse();
    }
    for (const nb of neighbors(n, idx)) {
      if (!parent.has(nb) && ok(nb)) {
        parent.set(nb, idx);
        queue.push(nb);
      }
    }
  }
  return null;
}

/** Red cells reachable from the top edge, grouped by flood distance. */
export function floodFromTop(cells, n) {
  const seen = new Set();
  let layer = [];
  for (let c = 0; c < n; c++) {
    if (cells[c] === RED) {
      seen.add(c);
      layer.push(c);
    }
  }
  const layers = [];
  while (layer.length) {
    layers.push(layer);
    const next = [];
    for (const idx of layer) {
      for (const nb of neighbors(n, idx)) {
        if (!seen.has(nb) && cells[nb] === RED) {
          seen.add(nb);
          next.push(nb);
        }
      }
    }
    layer = next;
  }
  return { layers, wet: seen };
}

/** Blue cells touching the water (or the top edge itself, where it was poured). */
export function waterline(cells, n, wet) {
  const edge = new Set();
  for (let idx = 0; idx < n * n; idx++) {
    if (cells[idx] !== BLUE) continue;
    const touchesTop = idx < n;
    if (touchesTop || neighbors(n, idx).some((nb) => wet.has(nb))) edge.add(idx);
  }
  return edge;
}

/** Points for drawing a chain: from its starting edge, through each cell, to the far edge. */
export function chainPoints(geo, path, color) {
  const { n, size, w } = geo;
  const pts = path.map((idx) => geo.center(Math.floor(idx / n), idx % n));
  const [fx, fy] = pts[0];
  const [lx, ly] = pts[pts.length - 1];
  if (color === RED) {
    pts.unshift([fx, fy - size]);
    pts.push([lx, ly + size]);
  } else {
    pts.unshift([fx - w / 2, fy]);
    pts.push([lx + w / 2, ly]);
  }
  return pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" ");
}
