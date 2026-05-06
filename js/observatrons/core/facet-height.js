// ============================================================
// FacetHeight — spike height calculation (Candidate A: verification magnitude)
//
// MVP implementation. Post-MVP this becomes λ-dependent:
//   λ = 0    → Hamming (discrete facet count)
//   λ = 2/3  → Euclidean (current: ‖[1, m, s, c]‖)
//   λ = 1    → Finsler (TBD)
// See facet_height.md for design notes.
// ============================================================

// Base-edge cap: single spike's base never exceeds 25% of sphere diameter.
const BASE_CAP_RATIO = 0.5;   // relative to sphereRadius (= 25% of diameter)
// Spike height scale factor (verification emphasis).
const HEIGHT_SCALE = 1.15;

export class FacetHeight {
  /**
   * Compute the height multiplier for a spike.
   *
   * @param {number[]} v — facet vector [data, meaning, structure, context],
   *   where data is always 1 and the others are 0 or 1.
   * @returns {number} magnitude in [1, 2]
   */
  static magnitude(v) {
    let s = 0;
    for (const x of v) s += x * x;
    return Math.sqrt(s);
  }

  /**
   * Compute the verified fraction from a facet vector.
   * Returns the proportion of the three elevated facets that are populated.
   *
   * @param {number[]} v — facet vector [data, meaning, structure, context]
   * @returns {number} fraction in [0, 1]
   */
  static verifiedFraction(v) {
    const mag = FacetHeight.magnitude(v);
    return (mag * mag - 1) / 3;
  }

  /**
   * Compute the tetrahedron base edge length for n spikes on a sphere.
   * Capped so a single spike never has a base larger than ~25% of the diameter.
   *
   * @param {number} n — total spike count
   * @param {number} sphereRadius
   * @returns {number} base edge length
   */
  static baseEdge(n, sphereRadius) {
    const raw = 2.8 * sphereRadius / Math.sqrt(Math.max(1, n));
    return Math.min(raw, BASE_CAP_RATIO * sphereRadius);
  }

  /**
   * Compute spike height given a base height reference, facet vector, and sphere radius.
   * Capped at sphereRadius so a spike never exceeds the sphere's own size.
   *
   * @param {number} baseHeightRef — base tetrahedron height for the current spike count
   * @param {number[]} v — facet vector [data, meaning, structure, context]
   * @param {number} sphereRadius
   * @returns {number} scaled spike height
   */
  static spikeHeight(baseHeightRef, v, sphereRadius) {
    const raw = baseHeightRef * FacetHeight.magnitude(v) * HEIGHT_SCALE;
    return Math.min(raw, sphereRadius);
  }
}
