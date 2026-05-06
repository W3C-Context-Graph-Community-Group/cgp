// dark-fraction.js — Re-exports shared math; provides SVG gauge for the liquid hypergraph view.

import {
  logBinom,
  logHammingBall,
  computeDarkFraction,
  formatLargeNumber,
  formatDelta,
} from '/lib/dark-fraction/DarkFraction.js';

export {
  logBinom,
  logHammingBall,
  computeDarkFraction,
  formatLargeNumber,
  formatDelta,
};

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
