import * as THREE from 'three';
import { OBS_RADIUS } from './math-utils.js';
import { FiberBundle } from './fiber-bundle.js';

/**
 * Determines which spike pairs to connect within visible channels,
 * then delegates rendering to FiberBundle (geodesic profile).
 */
export class ConnectionBuilder {

  static MAX_PAIRS = 50;

  // Fixed absolute sizes (match original visual)
  static BUNDLE_R = OBS_RADIUS * 0.012;   // strand separation radius
  static RING_R   = OBS_RADIUS * 0.025;   // endpoint ring radius

  /**
   * Build connection bundles and add them to group.
   * @returns {{ shown: number, total: number } | null} connection stats
   */
  static build(group, spikes, dirs, channelSpikeIndices, visibleChannels) {
    const numChannels = channelSpikeIndices.length;
    let connShown = 0;
    let connTotal = 0;

    for (let ci = 0; ci < numChannels; ci++) {
      if (ci < visibleChannels.min || ci > visibleChannels.max) continue;
      const indices = channelSpikeIndices[ci];
      const K = indices.length;
      if (K < 2) continue;

      // select pairs, cap at MAX_PAIRS
      const pairs = [];
      for (let a = 0; a < K - 1 && pairs.length < ConnectionBuilder.MAX_PAIRS; a++) {
        for (let b = a + 1; b < K && pairs.length < ConnectionBuilder.MAX_PAIRS; b++) {
          pairs.push([indices[a], indices[b]]);
        }
      }
      connTotal += K * (K - 1) / 2;
      connShown += pairs.length;

      // render each pair as a FiberBundle
      for (const [ai, bi] of pairs) {
        const startNormal = dirs[ai];
        const endNormal   = dirs[bi];
        const startPoint  = startNormal.clone().multiplyScalar(OBS_RADIUS * 1.003);
        const endPoint    = endNormal.clone().multiplyScalar(OBS_RADIUS * 1.003);

        // Convert fixed absolute sizes to fractions of separation
        // so FiberBundle's proportional API produces the right absolute values
        const separation = startPoint.distanceTo(endPoint);

        const bundle = new FiberBundle({
          startPoint,
          startNormal,
          endPoint,
          endNormal,
          curveProfile:  'geodesic',
          sphereCenter:  new THREE.Vector3(0, 0, 0),
          sphereRadius:  OBS_RADIUS,
          strandOffset:  ConnectionBuilder.BUNDLE_R / separation,
          ringRadius:    ConnectionBuilder.RING_R   / separation,
          strandOpacity: 0.4,
          showRings:     true,
        });
        group.add(bundle.build());
      }
    }

    return connShown > 0 ? { shown: connShown, total: connTotal } : null;
  }
}
