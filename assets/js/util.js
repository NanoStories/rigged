export const SVG_NS = "http://www.w3.org/2000/svg";

/** Create an SVG element with attributes, optionally appending it to a parent. */
export function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "one", "two" … "ten", then digits. */
export function word(n) {
  return n <= 10 ? WORDS[n] : String(n);
}

export function times(n) {
  if (n === 1) return "once";
  if (n === 2) return "twice";
  return `${n} times`;
}

export function show(...nodes) {
  for (const node of nodes) node.hidden = false;
}

export function hide(...nodes) {
  for (const node of nodes) node.hidden = true;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Join words as "a", "a and b", "a, b and c". */
export function listJoin(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
