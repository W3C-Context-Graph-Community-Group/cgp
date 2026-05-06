import * as THREE from 'three';

const PRESETS = {
  default: {
    sphereColor: 0x3a3a42,       // dark gray metallic
    channelColor: 0x555555,      // medium gray hole interior
    channelRimColor: 0x888888,   // lighter gray rim
    spikeColor(frac) {
      const f = Math.max(0, Math.min(1, frac));
      // unverified = dark gray, verified = bright white
      const g = 0.3 + f * 0.7;
      return new THREE.Color(g, g, g);
    },
    emptyColor: 0x2a2a30,
  },

  heat: {
    sphereColor: 0x2a2018,
    channelColor: 0xcc8800,
    channelRimColor: 0xffaa22,
    spikeColor(frac) {
      const f = Math.max(0, Math.min(1, frac));
      return new THREE.Color(0.9, 0.2 + f * 0.6, f * 0.15);
    },
    emptyColor: 0x1a1008,
  },

  ice: {
    sphereColor: 0x1a2530,
    channelColor: 0xbbaa22,
    channelRimColor: 0xddcc44,
    spikeColor(frac) {
      const f = Math.max(0, Math.min(1, frac));
      return new THREE.Color(0.3 + f * 0.7, 0.6 + f * 0.4, 0.8 + f * 0.2);
    },
    emptyColor: 0x0a1520,
  },

  mono: {
    sphereColor: 0x2a2a2a,
    channelColor: 0x999933,
    channelRimColor: 0xbbbb55,
    spikeColor(frac) {
      const f = Math.max(0, Math.min(1, frac));
      const g = 0.3 + f * 0.6;
      return new THREE.Color(g, g, g);
    },
    emptyColor: 0x1a1a1a,
  },
};

export class ColorScheme {
  constructor(name = 'default') {
    this._name = name;
    this._preset = PRESETS[name] || PRESETS.default;
    this.onChange = null;
  }

  get name() { return this._name; }

  static get presets() { return Object.keys(PRESETS); }

  set(name) {
    if (!PRESETS[name]) throw new Error(`ColorScheme: unknown preset "${name}"`);
    this._name = name;
    this._preset = PRESETS[name];
    if (this.onChange) this.onChange(name);
  }

  get sphereColor() {
    return this._preset.sphereColor;
  }

  get channelColor() {
    return this._preset.channelColor;
  }

  get channelRimColor() {
    return this._preset.channelRimColor;
  }

  spikeColor(verifiedFrac) {
    return this._preset.spikeColor(verifiedFrac);
  }

  get emptyColor() {
    return this._preset.emptyColor;
  }
}
