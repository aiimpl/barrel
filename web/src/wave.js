// The breaking wave as one surface: cross-sections swept along the wave (x), rebuilt every frame on the CPU.
// Frame (metres, wave-fixed): x along the crest (the break peels toward +x), y up (y = 0 at the trough), z toward
// the beach (+z). One cross-section is the water's edge, from far behind the wave, over the back and the crest, out
// along the top of the lip, round its tip, back along its underside, down the face (the back wall of the tube) to the
// trough, and out over the sea in front.
// How far the curl has gone, phi, depends on x and time: phi < 0 steep and unbroken, 0..1 the lip throws out and
// curls down, 1 it lands and the tube is closed, > 1.3 it collapses into whitewater (the foam ball).

export const SCALE = 1.9;      // the unit the spray was laid out in (a 3 m wave scaled to the 5.8 m one here)
export const H = 5.8;          // crest height above the trough (m)
export const PEEL = 11.0;      // how fast the break runs along the wave (m/s)
export const LPHI = 17.0;      // distance along the wave over which the lip goes from 0 to landed (m)


// the break point (where phi = 0) moves along the wave
export const breakX = (t) => -10 + PEEL * t;
// the reef's shape: around x0 the lip ahead (+x) throws early and the one behind late, so as it comes over the
// camera it lands on one side first and its edge runs across the view on a slant (amp set by the film)
export const PEAK = { x0: 0, amp: 0, off: 0, w: 6, back: 0 };
export const phiAt = (x, t) => {
  return (breakX(t) - x) / LPHI + PEAK.amp * Math.tanh((x - PEAK.x0 - PEAK.off) / PEAK.w)
    + PEAK.back * (Math.tanh((x - PEAK.x0 + 6) / 6) - 1) * 0.5;   // and behind it, later still
};
// the reef is not straight: ahead of x0 the wave bends round toward the beach (so from inside, looking at the beach,
// the open end is off to the left), and a little behind it too
export const BEND = { x0: 0, ahead: 0, behind: 0 };
export const bendZ = (x) => { const s = x - BEND.x0; return s > 0 ? BEND.ahead * s * s / (1 + s / 50) : BEND.behind * s * s / (1 - s / 50); };

const smooth = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
function bez(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
}

// one cross-section at curl phi (and a little along-crest variation w in -1..1): returns arrays of [z, y], thickness,
// the part of the water each point is on, and foam
// Keyframe cross-sections, taken from the real wave (Teahupoo side-on), in metres; the trough is y = 0, the beach +z.
// Like a hand-drawn profile, each is two continuous outlines joined by a rounded tip:
//   outer: from far behind, up the back, over the crest and along the top of the lip to its tip (9 points)
//   inner: from the tip back along the lip's underside, over the tube's ceiling and down the wall to the trough (9)
// The lip is thrown short and thick and the tube is an oval wider than it is tall. Its tip falls freely: from the crest
// (5.6 m) it drops 1 m in 0.45 s, 3.3 m by 0.82 s and lands at 1.0 s (y = 5.6 - 4.9 t^2), so with the break peeling at
// PEEL/LPHI = 0.65 phi per second the keys bunch up toward the landing (0.3, 0.54, 0.66). Between keyframes every point is
// interpolated with Catmull-Rom splines in phi (as in Surf's Up: sampled profiles, spline-interpolated).
const KEYS = [
  { phi: -0.6,
    outer: [[-40, 0], [-18, 0.3], [-7, 1.8], [-2.6, 4.0], [-0.6, 5.3], [0.5, 5.6], [1.0, 5.5], [1.3, 5.3], [1.4, 5.05]],
    inner: [[1.1, 4.85], [0.85, 4.65], [0.6, 4.3], [0.4, 3.7], [0.3, 2.8], [0.35, 1.8], [0.7, 0.9], [1.5, 0.25], [2.8, 0.03]] },
  { phi: 0.3,
    outer: [[-40, 0], [-18, 0.35], [-7, 2.0], [-2.5, 4.4], [-0.4, 5.65], [1.4, 6.05], [2.7, 5.75], [3.4, 5.1], [3.7, 4.5]],
    inner: [[3.15, 4.4], [2.6, 5.0], [1.6, 5.15], [0.5, 4.7], [-0.3, 3.7], [-0.5, 2.4], [-0.1, 1.1], [0.8, 0.25], [2.2, 0.03]] },
  { phi: 0.54,
    outer: [[-40, 0], [-18, 0.35], [-7, 2.1], [-2.5, 4.6], [-0.3, 5.8], [1.9, 6.1], [3.9, 5.6], [5.2, 4.1], [5.7, 2.3]],
    inner: [[5.05, 2.35], [4.6, 3.9], [3.3, 4.95], [1.6, 5.2], [0.0, 4.5], [-0.8, 3.0], [-0.6, 1.5], [0.3, 0.3], [1.9, 0.03]] },
  { phi: 0.66,
    outer: [[-40, 0], [-18, 0.35], [-7, 2.1], [-2.5, 4.6], [-0.3, 5.8], [2.1, 6.1], [4.5, 5.5], [6.2, 3.6], [6.7, 0.22]],
    inner: [[6.05, 0.22], [5.6, 3.2], [4.2, 4.75], [2.2, 5.2], [0.2, 4.6], [-0.8, 3.0], [-0.6, 1.5], [0.3, 0.3], [1.9, 0.03]] },
  { phi: 1.2,
    outer: [[-40, 0], [-18, 0.35], [-7, 2.0], [-2.5, 4.5], [-0.3, 5.7], [2.1, 6.0], [4.6, 5.4], [6.4, 3.5], [6.9, 0.22]],
    inner: [[6.2, 0.22], [5.8, 3.1], [4.4, 4.65], [2.3, 5.1], [0.2, 4.5], [-0.8, 2.9], [-0.6, 1.5], [0.3, 0.3], [1.9, 0.03]] },
  { phi: 2.0,
    outer: [[-40, 0], [-18, 0.35], [-7, 1.9], [-2.5, 4.3], [-0.3, 5.5], [2.1, 5.8], [4.6, 5.2], [6.4, 3.3], [6.9, 0.22]],
    inner: [[6.2, 0.22], [5.8, 2.9], [4.4, 4.45], [2.3, 4.9], [0.2, 4.3], [-0.8, 2.8], [-0.6, 1.5], [0.3, 0.3], [1.9, 0.03]] },
];
const NB = 50, NL = 140, NT = 13, NF = 90, NS = 44;     // points: back, lip (each side), tip, wall, sea
export const NSEC = NB + NL + NT + NL + NF + NS;

// Catmull-Rom through values v[] at knots k[] (non-uniform), evaluated at x
function crKnots(k, v, x) {
  const n = k.length;
  if (x <= k[0]) return v[0];
  if (x >= k[n - 1]) return v[n - 1];
  let i = 0; while (x > k[i + 1]) i++;
  const h = k[i + 1] - k[i], u = (x - k[i]) / h;
  const m = (j) => (j <= 0 || j >= n - 1 ? 0 : (v[j + 1] - v[j - 1]) / (k[j + 1] - k[j - 1]) * h);
  const m0 = m(i), m1 = m(i + 1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * m1;
}
// the keyframes blended at phi: every number of every keyframe, spline-interpolated through the keys
const KPHI = KEYS.map((k) => k.phi);
function keyAt(phi) {
  const at = (get) => crKnots(KPHI, KEYS.map(get), phi);
  const pts = (name) => KEYS[0][name].map((_, i) => [at((k) => k[name][i][0]), at((k) => k[name][i][1])]);
  return { outer: pts('outer'), inner: pts('inner') };
}
// a dense centripetal-free Catmull-Rom polyline through points (with optional phantom ends for matching tangents)
function curve(pts, pre, post, per = 24) {
  const q = [pre || [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]], ...pts,
    post || [2 * pts[pts.length - 1][0] - pts[pts.length - 2][0], 2 * pts[pts.length - 1][1] - pts[pts.length - 2][1]]];
  const out = [];
  for (let i = 1; i < q.length - 2; i++) {
    const [p0, p1, p2, p3] = [q[i - 1], q[i], q[i + 1], q[i + 2]];
    for (let s = 0; s < per; s++) {
      const u = s / per, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// n points evenly spaced by arc length along a polyline (end points included)
function resample(line, n) {
  const L = [0];
  for (let i = 1; i < line.length; i++) L.push(L[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const out = []; let j = 0;
  for (let k = 0; k < n; k++) {
    const d = L[L.length - 1] * k / (n - 1);
    while (j < L.length - 2 && L[j + 1] < d) j++;
    const u = (d - L[j]) / Math.max(L[j + 1] - L[j], 1e-9);
    out.push([line[j][0] + (line[j + 1][0] - line[j][0]) * u, line[j][1] + (line[j + 1][1] - line[j][1]) * u, (j + u) / (line.length - 1)]);
  }
  return out;
}

// one cross-section at curl phi (and a little along-crest variation w in -1..1): arrays of [z, y] (metres), thickness,
// the part of the water each point is on (0 back, 1 top of the lip, 2 its underside, 3 the wall, 4 the sea), foam
export function section(phi, w = 0) {
  const P = [], TH = [], PART = [], FOAM = [];
  const p = Math.min(Math.max(phi, -0.6), 2.8);
  const curl = smooth(0, 1, p);
  const K = keyAt(p);
  // a little variation along the crest: the lip a touch longer or shorter
  const vary = ([z, y], i) => [z > 0.5 ? z * (1 + 0.04 * w * Math.min(1, z / 6)) : z, y];
  const outer = K.outer.map(vary), inner = K.inner.map(vary);
  // each outline is one spline; split at its 5th point (outer: the crest, inner: the ceiling meets the wall)
  const PER = 28;
  const oc = curve(outer, null, null, PER), ic = curve(inner, null, null, PER);
  const split = 4 * PER;
  const back = resample(oc.slice(0, split + 1), NB + 1).slice(0, NB);
  const top = resample(oc.slice(split), NL);
  const under = resample(ic.slice(0, split + 1), NL);
  const wall = resample(ic.slice(split), NF + 1).slice(1);
  // the lip's thickness: across from each point on its top to the matching point on its underside
  const thk = (i) => Math.hypot(top[i][0] - under[NL - 1 - i][0], top[i][1] - under[NL - 1 - i][1]);
  for (const [z, y] of back) { P.push([z, y]); TH.push(3.0); PART.push(0); FOAM.push(0); }
  for (let i = 0; i < NL; i++) {
    P.push([top[i][0], top[i][1]]); TH.push(i < NL * 0.3 ? lerp(3.0, thk(i), i / (NL * 0.3)) : thk(i)); PART.push(1);
    FOAM.push(smooth(0.9, 1, i / (NL - 1)) * 0.2 * smooth(0.05, 0.4, curl));
  }
  // round the tip: a half circle from the top's end to the underside's start, bulging the way the lip travels
  {
    const a = top[NL - 1], b = under[0];
    const cz = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, r = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
    const ez = (a[0] - cz) / (r || 1), ey = (a[1] - cy) / (r || 1);          // centre -> top end
    const d0 = top[NL - 1], d1 = top[NL - 6];
    let tz = d0[0] - d1[0], ty = d0[1] - d1[1]; const tl = Math.hypot(tz, ty) || 1; tz /= tl; ty /= tl;   // travel
    for (let k = 1; k <= NT; k++) {
      const an = Math.PI * k / (NT + 1);
      P.push([cz + (ez * Math.cos(an) + tz * Math.sin(an)) * r, cy + (ey * Math.cos(an) + ty * Math.sin(an)) * r]);
      TH.push(2 * r); PART.push(1); FOAM.push(0.08 * smooth(0.05, 0.4, curl));
    }
  }
  for (let i = 0; i < NL; i++) {
    P.push([under[i][0], under[i][1]]); TH.push(thk(NL - 1 - i)); PART.push(2);
    FOAM.push(Math.max(smooth(0.9, 1, 1 - i / (NL - 1)) * 0.08 * curl, smooth(0.62, 0.8, p) * 0.5 * smooth(0.8, 0.1, under[i][1])));   // landed: its foot is churned white
  }
  for (let i = 0; i < NF; i++) { P.push([wall[i][0], wall[i][1]]); TH.push(lerp(thk(0), 3.0, Math.pow(i / (NF - 1), 0.7))); PART.push(3); FOAM.push(0); }
  // the sea in front, out toward the beach (under the lip where it has landed)
  {
    const z0 = P[P.length - 1][0];
    for (let i = 1; i <= NS; i++) {
      const u = i / NS;
      P.push([lerp(z0, 70, Math.pow(u, 1.8)), lerp(0.03, 0, u)]); TH.push(3.0); PART.push(4); FOAM.push(0);
    }
  }
  // collapse: far behind the camera the curl turns into a tumbling mound of whitewater
  const col = smooth(2.1, 2.7, phi);
  if (col > 0) {
    for (let i = 0; i < P.length; i++) {
      const [z, y] = P[i];
      const mound = 4.0 * Math.exp(-Math.pow((z - 2.6) / (z < 2.6 ? 6 : 4.2), 2));
      P[i] = [z, lerp(y, mound, col)];
      FOAM[i] = Math.max(FOAM[i], col * (PART[i] === 0 ? 0.25 : 0.85));
    }
  }
  const iTip = NB + NL + (NT >> 1);
  // where the lip has landed the water is churned white: a band of whitewater on the sea around the landing
  {
    const land = smooth(0.62, 0.8, p), tz = P[NB + NL + (NT >> 1)][0];
    if (land > 0) for (let i = 0; i < P.length; i++) {
      if (PART[i] !== 4) continue;
      const d = P[i][0] - tz;
      FOAM[i] = Math.max(FOAM[i], land * 0.6 * smooth(-1.4, -0.3, d) * (1 - smooth(0.8, 3.0, d)));
    }
  }
  const tipZ = P[iTip][0];
  const closed = smooth(0.6, 0.7, p) * (1 - smooth(2.1, 2.6, p));
  // inside a closed tube every surface sees the tube, not the sky: the lip's underside all over, the wall and the
  // floor up to where the lip has landed
  const OCC = P.map(([z], i) => (PART[i] === 2 ? closed : PART[i] >= 3 ? closed * smooth(tipZ + 1.2, tipZ - 0.6, z) : 0));
  return { P, TH, PART, FOAM, OCC, lipTip: P[iTip], iTip, curl };
}

// the swept surface: rows along x, NSEC points across
export class Wave {
  constructor(THREE, x0 = -130, x1 = 110, rows = 520) {
    this.THREE = THREE;
    this.rows = rows; this.x0 = x0; this.x1 = x1;
    const n = rows * NSEC;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    this.flow = new Float32Array(n); this.th = new Float32Array(n); this.part = new Float32Array(n); this.foam = new Float32Array(n); this.occ = new Float32Array(n); this.uv = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('thick', new THREE.BufferAttribute(this.th, 1));
    g.setAttribute('flow', new THREE.BufferAttribute(this.flow, 1));
    g.setAttribute('part', new THREE.BufferAttribute(this.part, 1));
    g.setAttribute('foam', new THREE.BufferAttribute(this.foam, 1));
    g.setAttribute('occ', new THREE.BufferAttribute(this.occ, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    const idx = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < NSEC - 1; c++) {
      const a = r * NSEC + c, b = a + 1, d = a + NSEC, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    g.setIndex(idx);
    this.geo = g;
  }

  // rows are spaced finer near the camera's x (xc)
  rowX(r, xc) {
    const u = r / (this.rows - 1) * 2 - 1;              // -1 .. 1
    const span0 = xc - this.x0, span1 = this.x1;        // behind / ahead of the camera
    const k = Math.sign(u) * Math.pow(Math.abs(u), 1.6);
    return xc + (k < 0 ? k * span0 : k * span1);
  }

  update(t, xc) {
    const { pos, th, part, foam, occ, uv, flow } = this;
    for (let r = 0; r < this.rows; r++) {
      const x = this.rowX(r, xc);
      // slow variation along the crest so the lip is not a perfect extrusion
      const w = Math.sin(x * 0.31 + 1.3) * 0.5 + Math.sin(x * 0.77 + 4.1) * 0.3 + Math.sin(x * 2.3 + 0.7) * 0.15 + Math.sin(x * 5.1 + 2.2) * 0.08;
      const s = section(phiAt(x, t) + 0.06 * Math.sin(x * 0.53), w);
      let arc = 0;
      const zb = bendZ(x);
      for (let c = 0; c < NSEC; c++) {
        const i = r * NSEC + c, [z, y] = s.P[c];
        if (c > 0) { const [z0, y0] = s.P[c - 1]; arc += Math.hypot(z - z0, y - y0); }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + zb;
        th[i] = s.TH[c]; part[i] = s.PART[c]; foam[i] = s.FOAM[c]; occ[i] = s.OCC[c];
        uv[i * 2] = x; uv[i * 2 + 1] = arc;
      }
      // how far along the section each point is from the lip's tip (the water in the lip runs toward it)
      const a0 = uv[(r * NSEC + s.iTip) * 2 + 1];
      for (let c = 0; c < NSEC; c++) { const i = r * NSEC + c; flow[i] = Math.abs(uv[i * 2 + 1] - a0); }
    }
    this.geo.attributes.position.needsUpdate = true;
    for (const a of ['thick', 'part', 'foam', 'occ', 'uv', 'flow']) this.geo.attributes[a].needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
