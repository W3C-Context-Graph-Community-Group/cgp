// dark-fraction.js — Pure math + SVG gauge for the liquid hypergraph view
// Ported from calculator/dark-fraction-core.js (vanilla JS, no React)

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

/**
 * Create an SVG gauge element showing delta / phi arcs.
 * @param {number} delta - Dark fraction (0-1)
 * @param {number} phi   - Verified fraction (0-1)
 * @param {number} size  - Pixel width/height (default 160)
 * @returns {HTMLElement} Wrapper div containing the SVG gauge
 */
export function createGauge(delta, phi, size = 160) {
  const r = 90;
  const circumference = 2 * Math.PI * r;
  const darkArc = circumference * delta;
  const verifiedArc = circumference * phi;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;width:${size}px;height:${size}px;margin:0 auto;`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.style.cssText = 'width:100%;height:100%;transform:rotate(-90deg);';

  // Background ring
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', '100');
  bgCircle.setAttribute('cy', '100');
  bgCircle.setAttribute('r', String(r));
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.1)');
  bgCircle.setAttribute('stroke-width', '16');
  svg.appendChild(bgCircle);

  // Dark fraction arc (red)
  const darkCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  darkCircle.setAttribute('cx', '100');
  darkCircle.setAttribute('cy', '100');
  darkCircle.setAttribute('r', String(r));
  darkCircle.setAttribute('fill', 'none');
  darkCircle.setAttribute('stroke', '#FF6B6B');
  darkCircle.setAttribute('stroke-width', '16');
  darkCircle.setAttribute('stroke-dasharray', `${darkArc} ${circumference - darkArc}`);
  darkCircle.setAttribute('stroke-dashoffset', '0');
  darkCircle.setAttribute('stroke-linecap', 'round');
  darkCircle.style.transition = 'stroke-dasharray 0.6s ease';
  svg.appendChild(darkCircle);

  // Verified arc (teal)
  const verifiedCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  verifiedCircle.setAttribute('cx', '100');
  verifiedCircle.setAttribute('cy', '100');
  verifiedCircle.setAttribute('r', String(r));
  verifiedCircle.setAttribute('fill', 'none');
  verifiedCircle.setAttribute('stroke', '#4ECDC4');
  verifiedCircle.setAttribute('stroke-width', '16');
  verifiedCircle.setAttribute('stroke-dasharray', `${verifiedArc} ${circumference - verifiedArc}`);
  verifiedCircle.setAttribute('stroke-dashoffset', `${-darkArc}`);
  verifiedCircle.setAttribute('stroke-linecap', 'round');
  verifiedCircle.style.transition = 'all 0.6s ease';
  svg.appendChild(verifiedCircle);

  wrapper.appendChild(svg);

  // Center label
  const label = document.createElement('div');
  label.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;';
  label.innerHTML =
    `<div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:#FF6B6B;line-height:1;">\u03b4</div>` +
    `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">${formatDelta(delta)}</div>`;
  wrapper.appendChild(label);

  return wrapper;
}
