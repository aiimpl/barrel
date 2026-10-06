// The breaking wave as one surface: cross-sections swept along the wave (x), rebuilt every frame on the CPU.
// Frame (metres, wave-fixed): x along the crest (the break peels toward +x), y up (y = 0 at the trough), z toward
// the beach (+z). One cross-section is the water's edge, from far behind the wave, over the back and the crest, out
// along the top of the lip, round its tip, back along its underside, down the face (the back wall of the tube) to the
// trough, and out over the sea in front.
// How far the curl has gone, phi, depends on x and time: phi < 0 steep and unbroken, 0..1 the lip throws out and
// curls down, 1 it lands and the tube is closed, > 1.3 it collapses into whitewater (the foam ball).

export const SCALE = 1.9;      // a heavy reef barrel: everything below is a 3 m wave, then scaled up
export const H = 3.0;          // wave height above the trough (m), before SCALE
export const PEEL = 11.0;      // how fast the break runs along the wave (m/s)
export const LPHI = 17.0;      // distance along the wave over which the lip goes from 0 to landed (m)
const T0 = 0.55;               // lip thickness at its root (m), before SCALE: a heavy, thick lip

const BACK = 40, FACE = 80, LIP = 170, TIP = 11, FRONT = 40;
export const NSEC = BACK + LIP + TIP + LIP + FACE + FRONT;   // points per cross-section

// the break point (where phi = 0) moves along the wave
export const breakX = (t) => -10 + PEEL * t;
export const phiAt = (x, t) => (breakX(t) - x) / LPHI;

const smooth = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
function bez(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
}

// one cross-section at curl phi (and a little along-crest variation w in -1..1): returns arrays of [z, y], thickness,
// the part of the water each point is on, and foam
export function section(phi, w = 0) {
  const P = [], TH = [], PART = [], FOAM = [];
  const p = Math.min(Math.max(phi, -2.0), 2.8);
  const curl = smooth(0, 1, p);                       // 0 .. 1 as the lip throws
  const crestZ = 0.25 + 0.45 * curl + 0.08 * w;       // the crest pitches forward as it throws
  // ahead of the break the shoulder is lower and its face leans back (a slope, not a cliff), easing to the peak
  const Hc = H * (1 + 0.04 * w) * (p < 0 ? lerp(0.55, 1, smooth(-2.0, 0, p)) : 1);
  const C = [crestZ, Hc];
  // the lip's centreline: leaves the crest heading forward and a little up, its curvature grows toward the tip
  const L = (0.15 + 5.2 * curl) * (1 + 0.06 * w);      // lip length (m): long enough to land on the water at curl 1
  const ds = L / LIP;
  const cl = [], ang = [];
  {
    let z = C[0], y = C[1] - T0 * 0.5, a = -0.12;     // a: angle below the +z axis (rad)
    const kTotal = (2.15 + 0.2 * w) * curl + 0.15 + 0.12 * smooth(1, 1.6, p);  // about 130 degrees when landed, a little more after
    for (let i = 0; i <= LIP; i++) {
      cl.push([z, y]); ang.push(a);
      const s = i / LIP;
      a += kTotal * (0.6 + 2.4 * s * s) / (0.6 + 0.8) / LIP;   // curvature rises toward the tip
      z += Math.cos(a) * ds; y -= Math.sin(a) * ds;
    }
    // where it reaches the water it lands and spreads along it instead of piercing it (a smooth floor)
    const floorY = (i) => (T0 * Math.pow(1 - i / LIP, 0.6) + 0.14) * 0.5 + 0.02;
    for (let i = 0; i <= LIP; i++) {
      const f = floorY(i), y0 = cl[i][1], k = 0.12;
      cl[i][1] = 0.5 * (y0 + f + Math.sqrt((y0 - f) * (y0 - f) + k * k));   // soft max(y0, f)
    }
    // directions follow the adjusted line
    for (let i = 0; i < LIP; i++) ang[i] = Math.atan2(-(cl[i + 1][1] - cl[i][1]), cl[i + 1][0] - cl[i][0]);
    ang[LIP] = ang[LIP - 1];
  }
  const thick = (i) => (T0 * Math.pow(1 - i / LIP, 0.6) + 0.14) * lerp(1.6, 1, curl);
  // back of the wave: from far behind, a long rise that arrives at the top of the lip's root heading the same way the
  // lip sets off (no corner at the crest)
  {
    const r0 = cl[0], a0 = ang[0], t0 = (T0 + 0.14) * lerp(1.6, 1, curl);
    const root = [r0[0] - Math.sin(a0) * t0 * 0.5, r0[1] + Math.cos(a0) * t0 * 0.5];
    const dir = [Math.cos(a0), -Math.sin(a0)];
    const b0 = [-40, 0], b1 = [-16, 0.05], b2 = [root[0] - dir[0] * 7, root[1] - dir[1] * 7 - 0.6];
    for (let i = 0; i < BACK; i++) {
      const u = Math.pow(i / BACK, 0.8);
      P.push(bez(b0, b1, b2, root, u)); TH.push(3.0); PART.push(0); FOAM.push(0);
    }
  }
  // top of the lip
  for (let i = 0; i <= LIP; i++) {
    const [z, y] = cl[i], a = ang[i], t = thick(i);
    P.push([z - Math.sin(a) * t * 0.5, y + Math.cos(a) * t * 0.5]); TH.push(t); PART.push(1);
    FOAM.push(smooth(0.9, 1, i / LIP) * 0.6 * smooth(0.05, 0.4, curl));
  }
  // round the tip: a half circle in the lip's own frame
  {
    const [z, y] = cl[LIP], a = ang[LIP], t = thick(LIP);
    const nx = -Math.sin(a), ny = Math.cos(a), tx = Math.cos(a), ty = -Math.sin(a);
    for (let k = 1; k <= TIP; k++) {
      const th = Math.PI * (k / (TIP + 1));
      P.push([z + (nx * Math.cos(th) + tx * Math.sin(th)) * t * 0.5, y + (ny * Math.cos(th) + ty * Math.sin(th)) * t * 0.5]);
      TH.push(t); PART.push(1); FOAM.push(0.6 * smooth(0.05, 0.4, curl));
    }
  }
  // underside of the lip, tip back to root
  for (let i = LIP; i >= 0; i--) {
    const [z, y] = cl[i], a = ang[i], t = thick(i);
    P.push([z + Math.sin(a) * t * 0.5, y - Math.cos(a) * t * 0.5]); TH.push(t); PART.push(2);
    FOAM.push(smooth(0.9, 1, i / LIP) * 0.6 * curl);
  }
  // the face: from under the crest down to the trough. It leaves the lip's underside in the same direction the
  // underside was heading (back and a little down), so wall and ceiling are one smooth curve; then it bends down
  // and comes in level at the trough. Seen from inside, the tube's cross-section is one rounded loop.
  {
    const top = P[P.length - 1], prev = P[P.length - 2];
    const dz = top[0] - prev[0], dy = top[1] - prev[1], dl = Math.hypot(dz, dy) || 1;
    const zt = 1.35 + 0.35 * curl + 1.8 * smooth(0, -1.6, p);   // trough, in front of the face (further out on the shoulder)
    const reach = 0.9 + 0.5 * curl;                     // how far back the wall bulges under the crest
    const p1 = [top[0] + dz / dl * reach, top[1] + dy / dl * reach];
    const p2 = [zt - 1.1 - 0.6 * curl, 0.0];             // level at the trough, so the face meets the sea without a crease
    for (let i = 1; i <= FACE; i++) {
      const u = i / FACE;
      P.push(bez(top, p1, p2, [zt, 0.0], u)); TH.push(lerp(thick(0), 2.5, Math.pow(u, 0.7))); PART.push(3);
      FOAM.push(0);
    }
  }
  // the sea in front, out toward the beach
  {
    const z0 = P[P.length - 1][0];
    for (let i = 1; i <= FRONT; i++) {
      const u = i / FRONT;
      const z = lerp(z0, 40, Math.pow(u, 1.8));
      P.push([z, 0.0]); TH.push(3.0); PART.push(4);
      FOAM.push(0);
    }
  }
  // collapse: past phi 1.3 the curl turns into a tumbling mound of whitewater
  const col = smooth(2.1, 2.7, phi);              // the tube stays closed a long way before it collapses
  if (col > 0) {
    for (let i = 0; i < P.length; i++) {
      const [z, y] = P[i];
      const mound = 2.1 * Math.exp(-Math.pow((z - 1.4) / (z < 1.4 ? 3.2 : 2.2), 2));
      P[i] = [z, lerp(y, mound, col)];
      FOAM[i] = Math.max(FOAM[i], col * (PART[i] === 0 ? 0.25 : 0.85));
    }
  }
  for (let i = 0; i < P.length; i++) { P[i] = [P[i][0] * SCALE, P[i][1] * SCALE]; TH[i] *= SCALE; }
  const tipZ = P[BACK + LIP + 1 + (TIP >> 1)][0];
  const closed = smooth(0.85, 1.05, p) * (1 - smooth(2.1, 2.6, p));
  const OCC = P.map(([z], i) => (PART[i] >= 2 && z < tipZ + 0.3 ? closed : 0));
  // where the lip has landed it lies on the water: there it is churned white, not a smooth sheet (from inside the
  // tube that sheet read as a still haze)
  for (let i = 0; i < P.length; i++) {
    if (PART[i] !== 1) continue;
    const low = smooth(1.6 * SCALE, 0.25 * SCALE, P[i][1]);
    FOAM[i] = Math.max(FOAM[i], closed * low * 0.85);
    OCC[i] = Math.max(OCC[i], closed * (P[i][0] < tipZ + 2.5 ? 1 : low));   // the curtain's outer face, where it folds into view from inside
  }
  return { P, TH, PART, FOAM, OCC, lipTip: P[BACK + LIP + 1 + (TIP >> 1)], curl };
}

// the swept surface: rows along x, NSEC points across
export class Wave {
  constructor(THREE, x0 = -130, x1 = 45, rows = 460) {
    this.THREE = THREE;
    this.rows = rows; this.x0 = x0; this.x1 = x1;
    const n = rows * NSEC;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    this.th = new Float32Array(n); this.part = new Float32Array(n); this.foam = new Float32Array(n); this.occ = new Float32Array(n); this.uv = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('thick', new THREE.BufferAttribute(this.th, 1));
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
    const { pos, th, part, foam, occ, uv } = this;
    for (let r = 0; r < this.rows; r++) {
      const x = this.rowX(r, xc);
      // slow variation along the crest so the lip is not a perfect extrusion
      const w = Math.sin(x * 0.31 + 1.3) * 0.55 + Math.sin(x * 0.77 + 4.1) * 0.3;   // slow only: fast ones carved flutes along the wall
      const s = section(phiAt(x, t) + 0.06 * Math.sin(x * 0.53), w);
      let arc = 0;
      for (let c = 0; c < NSEC; c++) {
        const i = r * NSEC + c, [z, y] = s.P[c];
        if (c > 0) { const [z0, y0] = s.P[c - 1]; arc += Math.hypot(z - z0, y - y0); }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        th[i] = s.TH[c]; part[i] = s.PART[c]; foam[i] = s.FOAM[c]; occ[i] = s.OCC[c];
        uv[i * 2] = x; uv[i * 2 + 1] = arc;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    for (const a of ['thick', 'part', 'foam', 'occ', 'uv']) this.geo.attributes[a].needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
