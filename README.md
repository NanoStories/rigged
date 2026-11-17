# Rigged

Games you can’t win. Each one is a theorem in disguise.

**Play it at [nanostories.github.io/rigged](https://nanostories.github.io/rigged/)**

Every game hands you a challenge that looks perfectly doable. You try it, and you lose. Then the House shows you how it beat you, and its strategy turns out to be the proof, run on your own losing position.

## The tables

| Game | The challenge | What beats you |
| --- | --- | --- |
| [Six Dots](https://nanostories.github.io/rigged/six-dots/) | Color the 15 lines between six dots red or blue without making a one-color triangle. (Five dots first, as a warm-up you *can* win.) | Ramsey’s theorem, R(3,3) = 6 |
| [Every Prime](https://nanostories.github.io/rigged/every-prime/) | Write down every prime number. | Euclid’s proof that the primes never run out |
| [Nobody Wins](https://nanostories.github.io/rigged/nobody-wins/) | Fill a Hex board so neither red (top to bottom) nor blue (left to right) connects. | The Hex theorem, equivalent to Brouwer’s fixed-point theorem |

The lobby’s header is a game too: the six letters of RIGGED are joined by fifteen arcs, and you can flip them as much as you like. There are always at least two one-color triangles.

## How it’s built

A plain static site: HTML, CSS and JavaScript modules, with no build step, no dependencies and no tracking. Loss tallies are kept in your own browser’s local storage and never leave it.

- `index.html`, `assets/js/lobby.js`: the lobby and its interactive wordmark
- `assets/js/ramsey.js`: two-colorings of complete graphs, shared by the lobby and Six Dots
- `assets/js/hex.js`: Hex board geometry, chain finding and the flood used in the proof
- `every-prime/primes-core.js`: Miller–Rabin primality and Pollard–Brent factoring with `BigInt`, run in a Web Worker
- `assets/css/rigged.css`: the shared design (red and blue belong to the player, gold belongs to the House)

To run it locally, serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Opening `index.html` straight from disk won’t work, because browsers block JavaScript modules on `file://` pages.)

## Adding a table

Each game lives in its own folder with an `index.html` and a script. A good new table has three things: a challenge that looks winnable, a theorem that makes it unwinnable, and a proof that can be shown on the player’s own losing position. Some candidates: Cantor’s diagonal argument (“list every real number”), Sperner’s lemma, Euler’s formula for planar graphs, and the pigeonhole principle.

## Credits

Designed and built by Claude, an AI model made by Anthropic.

Typefaces: [Besley](https://github.com/indestructible-type/Besley) by Owen Earl and [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next) by the Braille Institute, both under the SIL Open Font License (see `assets/fonts/`).
