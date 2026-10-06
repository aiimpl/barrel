// Spray and mist. Drops are thrown off the lip's tip along its direction of travel and fall under gravity; where the
// lip lands, a sheet of splash goes up; fine mist hangs in the tube and catches the light through the lip.
// Each drop is a pure function of its own seed and the time (no simulation state), so any frame can be drawn alone.
import { section, phiAt, SCALE } from './wave.js';

const vert = /* glsl */`
attribute float size; attribute float alpha;
uniform float uPx;
varying float vA; varying float vS;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float px = size * uPx / max(-mv.z, 0.05);
  vS = px; vA = alpha;
  gl_PointSize = clamp(px, 1.0, 64.);
}`;
const frag = /* glsl */`
uniform vec3 uSun; uniform vec3 uSunCol;
varying float vA; varying float vS;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.;
  float k = vS < 1.5 ? vS / 1.5 : 1.;
  float a = exp(-r * r * 3.) * vA * k;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(0.93, 0.97, 1.0) * a, a);
}`;

const smooth = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export class Spray {
  constructor(THREE, n = 22000) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.u = { uPx: { value: 800 }, uSun: { value: null }, uSunCol: { value: null } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.points.frustumCulled = false;
    this.cache = new Map();
  }

  // the lip tip at x (cached per frame on a 0.25 m grid)
  tip(x, t) {
    const key = Math.round(x * 4);
    if (this.cache.has(key)) return this.cache.get(key);
    const s = section(phiAt(key / 4, t));
    const v = { z: s.lipTip[0], y: s.lipTip[1], curl: s.curl, phi: phiAt(key / 4, t) };
    this.cache.set(key, v);
    return v;
  }

  // t: time; xc: the rider's x; spit 0..1: the burst of spray blown out of the tube at the end
  update(t, xc, spit = 0) {
    this.cache.clear();
    const { pos, size, alpha } = this;
    let k = 0;
    const put = (x, y, z, s, a) => { if (k >= this.n) return; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; size[k] = s; alpha[k] = a; k++; };
    // drops off the lip: born along the tip line, 0.9 s life, thrown forward and down
    const N1 = 4200;
    for (let i = 0; i < N1; i++) {
      const life = 0.9, born = t - hash(i * 3.1) * life * 1.0;
      const age = t - born;
      const x0 = xc - 14 + hash(i * 7.7) * 30;
      const tp = this.tip(x0, born);
      if (tp.curl < 0.15) continue;
      const vz = 2.2 + 1.5 * hash(i * 2.3), vy = 0.4 + 1.2 * hash(i * 5.9), vx = (hash(i * 9.1) - 0.5) * 1.2;
      const x = x0 + vx * age, z = tp.z + vz * age, y = tp.y + vy * age - 4.9 * age * age;
      if (y < -0.05) continue;
      const a = (1 - age / life) * 0.55 * tp.curl;
      put(x, y, z, 0.012 + 0.02 * hash(i * 4.4), a);
    }
    // offshore wind: a veil of spray torn off the crest, blown back over the wave (toward -z) and rising
    const N4 = 6000;
    for (let i = 0; i < N4; i++) {
      const life = 1.6, born = t - hash(i * 8.3) * life;
      const age = t - born;
      const x0 = xc - 18 + hash(i * 3.7) * 40;
      const tp = this.tip(x0, born);
      if (tp.phi < -1.6 || tp.curl > 0.95) continue;     // all along the crest: the unbroken shoulder feathers too
      const cz = tp.z - 0.3, cy = tp.y + 0.3;
      const x = x0 + (hash(i * 1.9) - 0.5) * 0.8, z = cz - (2.5 + 2.5 * hash(i * 6.3)) * age, y = cy + (0.9 + 0.9 * hash(i * 4.9)) * age - 1.2 * age * age;
      const a = (1 - age / life) * 0.3 * (tp.phi < 0 ? 0.8 * smooth(-1.6, -0.2, tp.phi) : Math.sin(Math.PI * Math.min(1, 0.33 + tp.curl * 1.2)));
      put(x, y, z, 0.12 + 0.2 * hash(i * 2.2) + age * 0.35, a * 1.4);
    }
    // mist in the tube: slow, faint, larger
    const N2 = 2600;
    for (let i = 0; i < N2; i++) {
      const x = xc - 6 + ((hash(i * 1.7) * 16 + t * 0.6) % 16);
      const tp = this.tip(x, t);
      if (tp.curl < 0.6) continue;
      const z = 0.6 * SCALE + hash(i * 3.3) * (tp.z - 0.6 * SCALE);
      const y = 0.15 + hash(i * 6.1) * 2.3 * SCALE + 0.08 * Math.sin(t * 1.3 + i);
      put(x, y, z, 0.05 + 0.08 * hash(i * 8.8), 0.035);
    }
    // the spit: a blast of fine spray and mist down the tube's axis, overtaking the rider and leaving through the eye
    if (spit > 0) {
      const N3 = 7000;
      for (let i = 0; i < N3; i++) {
        const lag = hash(i * 2.9) * 0.5;
        const p = Math.max(0, Math.min(1, (spit - lag) / (1 - lag * 0.5)));
        if (p <= 0) continue;
        const x = xc - 4 + p * 24 + (hash(i * 4.1) - 0.5) * 3;
        const r = (0.15 + 1.05 * Math.sqrt(hash(i * 5.3))) * (0.6 + 0.9 * p), th = hash(i * 6.7) * 6.283;
        const mist = i % 5 === 0;     // one in five is a soft puff of mist, the rest fine drops
        put(x, Math.max(0.1, 1.25 * SCALE + r * SCALE * Math.sin(th)), 1.95 * SCALE + r * SCALE * Math.cos(th),
          mist ? 0.35 + 0.6 * p : 0.012 + 0.02 * hash(i * 7.3), mist ? 0.08 * (1 - p) : 0.8 * (1 - p * 0.7));
      }
    }
    for (; k < this.n; k++) alpha[k] = 0;
    for (const a of ['position', 'size', 'alpha']) this.points.geometry.attributes[a].needsUpdate = true;
  }
}
