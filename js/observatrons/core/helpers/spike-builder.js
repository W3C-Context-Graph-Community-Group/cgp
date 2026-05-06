import * as THREE from 'three';
import { OBS_RADIUS, darkFraction } from './math-utils.js';
import { FacetHeight } from '../facet-height.js';

/**
 * Derives spike data from the channel manager and builds
 * the sphere, channel caps, and spike tetrahedron geometry.
 */
export class SpikeBuilder {

  /**
   * Extract spike data and region stats from channel events.
   */
  static deriveSpikes(channelMgr) {
    const spikes = [];
    const events = channelMgr.events;

    const channelIndex = new Map();
    for (const ev of events) {
      if (!channelIndex.has(ev.channel)) {
        channelIndex.set(ev.channel, channelIndex.size);
      }
    }

    const channelStats = new Map();
    for (const [ch] of channelIndex) channelStats.set(ch, { m: 0, r: 0 });

    for (const ev of events) {
      const regionIdx = channelIndex.get(ev.channel);
      const st = channelStats.get(ev.channel);
      for (const att of ev.attachments) {
        for (const col of att.columns) {
          const f = col.facets;
          const mBit = f['/meaning'].symbol.length   > 0 ? 1 : 0;
          const sBit = f['/structure']['constraint-key'].length > 0 ? 1 : 0;
          const cBit = f['/context'].timestamp.length > 0 ? 1 : 0;
          const v = [1, mBit, sBit, cBit];
          spikes.push({
            region: regionIdx,
            v,
            col,
            channel: ev.channel,
            eventUrl: ev.url,
            anchorUrl: att.url,
          });
          st.m += 1;
          st.r += mBit + sBit + cBit;
        }
      }
    }

    const regionStats = [];
    for (const [, st] of channelStats) {
      regionStats.push({ m: st.m, r: st.r, n: 3 * st.m, delta: darkFraction(3 * st.m, st.r) });
    }

    return { spikes, regionStats };
  }

  /**
   * Compute channel centroids, spike directions, and per-channel metadata.
   * Returns { channels, dirs, channelSpikeIndices, spikesPerChannel }.
   */
  static computeLayout(spikes, regionStats) {
    const n = spikes.length;
    const numChannels = regionStats.length;

    // channel centroids: Fibonacci sphere placement
    const channelCentroids = [];
    if (numChannels === 1) {
      channelCentroids.push(new THREE.Vector3(0, 1, 0));
    } else {
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let ci = 0; ci < numChannels; ci++) {
        const cy = 1 - (ci / (numChannels - 1)) * 2;
        const cr = Math.sqrt(Math.max(0, 1 - cy * cy));
        const ct = ci * ga;
        channelCentroids.push(new THREE.Vector3(Math.cos(ct) * cr, cy, Math.sin(ct) * cr));
      }
    }

    // spikes per channel
    const spikesPerChannel = new Array(numChannels).fill(0);
    for (const sp of spikes) spikesPerChannel[sp.region]++;

    // channel cap angles from spike count + footprint
    const spikeFootprint = Math.asin(Math.min(1, FacetHeight.baseEdge(n, OBS_RADIUS) / (Math.sqrt(3) * OBS_RADIUS)));
    const channels = [];
    for (let ci = 0; ci < numChannels; ci++) {
      const K = spikesPerChannel[ci];
      const rawAngle = spikeFootprint * Math.sqrt(K) + Math.PI / 26;
      const capAngle = Math.max(Math.PI / 18, Math.min(Math.PI / 3, rawAngle));
      channels.push({ centroid: channelCentroids[ci], angle: capAngle });
    }

    // spike directions: Fibonacci within each channel's cone
    const dirs = new Array(n);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const channelSpikeIndices = Array.from({ length: numChannels }, () => []);
    for (let si = 0; si < n; si++) channelSpikeIndices[spikes[si].region].push(si);

    for (let ci = 0; ci < numChannels; ci++) {
      const ch = channels[ci];
      const indices = channelSpikeIndices[ci];
      const K = indices.length;
      const spreadAngle = ch.angle * 0.7;

      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), ch.centroid
      );

      for (let j = 0; j < K; j++) {
        const t = K === 1 ? 0 : j / (K - 1);
        const ly = 1 - t * (1 - Math.cos(spreadAngle));
        const lr = Math.sqrt(Math.max(0, 1 - ly * ly));
        const phi = j * goldenAngle;
        const localDir = new THREE.Vector3(Math.cos(phi) * lr, ly, Math.sin(phi) * lr);
        localDir.applyQuaternion(q).normalize();
        dirs[indices[j]] = localDir;
      }
    }

    return { channels, dirs, channelSpikeIndices, spikesPerChannel };
  }

  /**
   * Build the sphere, channel-cap, and spike-tetrahedron geometry.
   * Returns the THREE.Group containing all meshes.
   */
  static buildGeometry(group, spikes, regionStats, dirs, channels, colorScheme) {
    const n = spikes.length;
    const cs = colorScheme;
    const numChannels = regionStats.length;

    const sphereColor  = cs ? cs.sphereColor  : 0x3a3a42;
    const channelColor = cs ? cs.channelColor : 0x1a1a20;
    const emptyColor   = cs ? cs.emptyColor   : 0x2a2a30;

    if (n === 0) {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(OBS_RADIUS, 48, 48),
        new THREE.MeshPhongMaterial({ color: emptyColor, shininess: 40 })
      ));
      return;
    }

    // ── sphere ──
    const sphereGeo = new THREE.SphereGeometry(OBS_RADIUS * 0.999, 64, 64);
    group.add(new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({
      color: sphereColor, shininess: 40
    })));

    // ── channel caps ──
    for (let ci = 0; ci < numChannels; ci++) {
      const ch = channels[ci];
      const capR = OBS_RADIUS * 1.001;
      const capGeo = new THREE.SphereGeometry(capR, 48, 24, 0, Math.PI * 2, 0, ch.angle);

      const capPos = capGeo.attributes.position;
      const alphas = new Float32Array(capPos.count);
      const fadeStart = ch.angle * 0.9;
      for (let vi = 0; vi < capPos.count; vi++) {
        const y = capPos.getY(vi);
        const theta = Math.acos(Math.min(1, Math.max(-1, y / capR)));
        alphas[vi] = theta <= fadeStart
          ? 1.0
          : Math.max(0, 1.0 - (theta - fadeStart) / (ch.angle - fadeStart));
      }
      capGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

      const capMat = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(channelColor) } },
        vertexShader: [
          'attribute float alpha;',
          'varying float vAlpha;',
          'void main() {',
          '  vAlpha = alpha;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}',
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 color;',
          'varying float vAlpha;',
          'void main() {',
          '  gl_FragColor = vec4(color, vAlpha);',
          '}',
        ].join('\n'),
        transparent: true,
        depthWrite: false,
      });

      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ch.centroid);
      group.add(capMesh);

      // ── channel border ring ──
      const rimColor = cs ? cs.channelRimColor : 0x888888;
      const ringSegments = 64;
      const ringR = capR * 1.002;
      const sinA = Math.sin(ch.angle);
      const cosA = Math.cos(ch.angle);
      const ringPoints = [];
      for (let j = 0; j < ringSegments; j++) {
        const phi = (j / ringSegments) * Math.PI * 2;
        ringPoints.push(new THREE.Vector3(
          ringR * sinA * Math.cos(phi),
          ringR * cosA,
          ringR * sinA * Math.sin(phi)
        ));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
      const ringLine = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color: rimColor }));
      ringLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ch.centroid);
      group.add(ringLine);
    }

    // ── spikes: one tetrahedron per column ──
    const baseEdge = FacetHeight.baseEdge(n, OBS_RADIUS);
    const rBase = baseEdge / Math.sqrt(3);
    const baseHeightRef = baseEdge * Math.sqrt(2 / 3);

    const tmpRef = new THREE.Vector3();
    const u = new THREE.Vector3();
    const v3 = new THREE.Vector3();

    const dotDiscGeo = new THREE.CircleGeometry(rBase * 0.35, 24);
    const dotDiscMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    for (let i = 0; i < n; i++) {
      const normal = dirs[i];
      const sp = spikes[i];
      const hTetra = FacetHeight.spikeHeight(baseHeightRef, sp.v, OBS_RADIUS);

      const verifiedFrac = FacetHeight.verifiedFraction(sp.v);
      const spikeCol = cs
        ? cs.spikeColor(verifiedFrac)
        : new THREE.Color(0.25 + verifiedFrac * 0.75, 0.45 + verifiedFrac * 0.55, 0.5 + verifiedFrac * 0.5);

      const basePt = normal.clone().multiplyScalar(OBS_RADIUS * 1.003);
      const apex   = normal.clone().multiplyScalar(OBS_RADIUS + hTetra);

      tmpRef.set(0, 1, 0);
      if (Math.abs(normal.y) > 0.98) tmpRef.set(1, 0, 0);
      u.crossVectors(normal, tmpRef).normalize();
      v3.crossVectors(normal, u).normalize();

      const bv = [];
      for (let k = 0; k < 3; k++) {
        const phi = (2 * Math.PI * k) / 3;
        bv.push(
          basePt.clone()
            .addScaledVector(u, rBase * Math.cos(phi))
            .addScaledVector(v3, rBase * Math.sin(phi))
        );
      }

      // black dot disc on sphere surface below spike
      const dotMesh = new THREE.Mesh(dotDiscGeo, dotDiscMat);
      const dotPt = normal.clone().multiplyScalar(OBS_RADIUS * 1.002);
      dotMesh.position.copy(dotPt);
      dotMesh.lookAt(dotPt.clone().multiplyScalar(2));
      dotMesh.userData.dotDisc = true;
      group.add(dotMesh);

      // tetrahedron base (channel hole color)
      const baseGeom = new THREE.BufferGeometry();
      baseGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        bv[0].x, bv[0].y, bv[0].z,
        bv[2].x, bv[2].y, bv[2].z,
        bv[1].x, bv[1].y, bv[1].z,
      ]), 3));
      baseGeom.computeVertexNormals();
      group.add(new THREE.Mesh(baseGeom, new THREE.MeshPhongMaterial({
        color: channelColor, shininess: 10, flatShading: true
      })));

      // three side faces (spike color based on verification)
      const sideGeom = new THREE.BufferGeometry();
      sideGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        bv[0].x, bv[0].y, bv[0].z,  bv[1].x, bv[1].y, bv[1].z,  apex.x, apex.y, apex.z,
        bv[1].x, bv[1].y, bv[1].z,  bv[2].x, bv[2].y, bv[2].z,  apex.x, apex.y, apex.z,
        bv[2].x, bv[2].y, bv[2].z,  bv[0].x, bv[0].y, bv[0].z,  apex.x, apex.y, apex.z,
      ]), 3));
      sideGeom.computeVertexNormals();
      const sideMesh = new THREE.Mesh(sideGeom, new THREE.MeshPhongMaterial({
        color: spikeCol, shininess: 60, flatShading: true,
        transparent: true, opacity: 0.9,
      }));
      sideMesh.userData.facetSide = true;
      sideMesh.userData.spikeIndex = i;
      group.add(sideMesh);
    }

  }
}
