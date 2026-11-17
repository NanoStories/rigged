// Two-colorings of the lines between n dots (complete graph K_n),
// shared by the lobby header and the Six Dots game.

export const other = (color) => (color === "red" ? "blue" : "red");

export class Coloring {
  constructor(n) {
    this.n = n;
    this.map = new Map();
  }

  static key(i, j) {
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }

  get(i, j) {
    return this.map.get(Coloring.key(i, j)) || null;
  }

  set(i, j, color) {
    const key = Coloring.key(i, j);
    if (color) this.map.set(key, color);
    else this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }

  get total() {
    return (this.n * (this.n - 1)) / 2;
  }

  isFull() {
    return this.map.size === this.total;
  }

  pairs() {
    const out = [];
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) out.push([i, j]);
    }
    return out;
  }

  empties() {
    return this.pairs().filter(([i, j]) => !this.get(i, j));
  }

  /** Every triangle whose three lines share one color. */
  triangles() {
    const found = [];
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        const c = this.get(i, j);
        if (!c) continue;
        for (let k = j + 1; k < this.n; k++) {
          if (this.get(j, k) === c && this.get(i, k) === c) {
            found.push({ verts: [i, j, k], color: c });
          }
        }
      }
    }
    return found;
  }

  clone() {
    const copy = new Coloring(this.n);
    copy.map = new Map(this.map);
    return copy;
  }
}

/** The three lines of a triangle, as [i, j] pairs. */
export function triangleEdges([a, b, c]) {
  return [
    [a, b],
    [b, c],
    [a, c],
  ];
}
