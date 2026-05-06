// IMPORTANT: ALWAYS USE r/meta/schema.md as your primary source of truth to align to!

// DarkFraction.js — Pure dark-fraction math.
//
// CANONICAL SOURCE: calculator/dark-fraction-core.js (lines 77–134).
// This file is a copy. If they diverge, the calculator is correct.
// Do not edit math here without matching the calculator in the same commit.
//
// CONVENTION: M counts spikes only.
//
// δ measures unverified configuration space in what an observatron
// has observed. M = number of spikes. N = 3M (one slot each for
// /data, /meaning, /structure across all spikes). R = number of
// those facets that are populated.
//
// Observatrons are not counted. Their facets describe the observer
// (instantiation params, what it watches, its config) — not anything
// observed. Spikes are the observations; only spikes contribute to δ.
//
// This file does not know about observatrons or spikes. It just does
// the math. Callers compute M and R upstream and must follow the
// convention above for δ values to be comparable across views.

export function logBinom(n, k) {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  if (k > n - k) k = n - k;
  let result = 0;
  for (let i = 0; i < k; i++) {
    result += Math.log2(n - i) - Math.log2(i + 1);
  }
  return result;
}

export function logHammingBall(n, r) {
  if (r >= n) return n;
  if (r < 0) return -Infinity;
  let maxLog = logBinom(n, 0);
  for (let k = 1; k <= r; k++) {
    maxLog = Math.max(maxLog, logBinom(n, k));
  }
  let sum = 0;
  for (let k = 0; k <= r; k++) {
    sum += Math.pow(2, logBinom(n, k) - maxLog);
  }
  return maxLog + Math.log2(sum);
}

export function computeDarkFraction(m, r) {
  const n = 3 * m;
  if (n === 0) return { delta: 0, phi: 1, logBr: 0, logOmega: 0, n, exact: true };
  if (r >= n) return { delta: 0, phi: 1, logBr: n, logOmega: n, n, exact: true };
  const logOmega = n;
  const logBr = logHammingBall(n, r);
  const phi = Math.pow(2, logBr - logOmega);
  const delta = 1 - phi;
  return { delta, phi, logBr, logOmega, n, exact: false };
}

export function formatLargeNumber(logVal) {
  if (logVal <= 0) return '1';
  const log10Val = logVal * Math.log10(2);
  if (log10Val < 6) {
    return Math.round(Math.pow(2, logVal)).toLocaleString();
  }
  const mantissa = Math.pow(10, log10Val - Math.floor(log10Val));
  const exponent = Math.floor(log10Val);
  return `${mantissa.toFixed(2)} \u00d7 10^${exponent}`;
}

export function formatDelta(delta) {
  if (delta === 0) return '0%';
  if (delta === 1) return '100%';
  if (delta >= 0.99999) {
    const nines = -Math.log10(1 - delta);
    return `\u2248 ${'9'.repeat(Math.min(Math.floor(nines), 12))}.${'9'.repeat(Math.max(0, Math.min(Math.ceil(nines) - Math.floor(nines) > 0 ? 1 : 0, 4)))}%`.replace(/\.$/, '%');
  }
  if (delta > 0.9999) return `${(delta * 100).toFixed(6)}%`;
  if (delta > 0.99) return `${(delta * 100).toFixed(4)}%`;
  return `${(delta * 100).toFixed(2)}%`;
}
