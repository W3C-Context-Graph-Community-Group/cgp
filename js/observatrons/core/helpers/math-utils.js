import * as THREE from 'three';

export const OBS_RADIUS = 0.5;

export function darkFraction(n, r) {
  if (n <= 0) return 0;
  if (r < 0)  return 1;
  if (r >= n) return 0;
  let q = Math.pow(2, -n);
  let sum = q;
  for (let k = 1; k <= r; k++) {
    q = q * (n - k + 1) / k;
    sum += q;
  }
  return Math.max(0, Math.min(1, 1 - sum));
}

export function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export function hashUrl(url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

export function spikeFrame(dir, url) {
  const up = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const twist = new THREE.Quaternion().setFromAxisAngle(dir, hashUrl(url));
  return base.multiply(twist);
}
