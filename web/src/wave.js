// The breaking wave as one surface: cross-sections swept along the wave (x), rebuilt every frame on the CPU.
// Frame (metres, wave-fixed): x along the crest (the break peels toward +x), y up (y = 0 at the trough), z toward
// the beach (+z). One cross-section is the water's edge, from far behind the wave, over the back and the crest, out
// along the top of the lip, round its tip, back along its underside, down the face (the back wall of the tube) to the
// trough, and out over the sea in front.
// How far the curl has gone, phi, depends on x and time: phi < 0 steep and unbroken, 0..1 the lip throws out and
// curls down, 1 it lands and the tube is closed, > 1.3 it collapses into whitewater (the foam ball).

export const H = 3.0;          // wave height above the trough (m)
export const PEEL = 7.0;       // how fast the break runs along the wave (m/s)
export const LPHI = 9.0;       // distance along the wave over which the lip goes from 0 to landed (m)
const T0 = 0.34;               // lip thickness at its root (m)

const BACK = 34, FACE = 30, LIP = 64, TIP = 7, FRONT = 34;
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
  const p = Math.min(Math.max(phi, -0.6), 1.6);
  const curl = smooth(0, 1, p);                       // 0 .. 1 as the lip throws
  const crestZ = 0.25 + 0.45 * curl + 0.08 * w;       // the crest pitches forward as it throws
  const Hc = H * (1 + 0.04 * w) * (p < 0 ? lerp(0.82, 1, smooth(-0.6, 0, p)) : 1);
  const C = [crestZ, Hc];
  // the lip's centreline: leaves the crest heading forward and a little up, its curvature grows toward the tip
  const L = 0.15 + 5.2 * curl;                         // lip length (m): long enough to land on the water at curl 1
  const ds = L / LIP;
  const cl = [], ang = [];
  {
    let z = C[0], y = C[1] - T0 * 0.5, a = -0.12;     // a: angle below the +z axis (rad)
    const kTotal = (2.15 + 0.2 * w) * curl + 0.15;     // total turning of the lip (rad): about 130 degrees when landed
    for (let i = 0; i <= LIP; i++) {
      cl.push([z, y]); ang.push(a);
      const s = i / LIP;
      a += kTotal * (0.6 + 2.4 * s * s) / (0.6 + 0.8) / LIP;   // curvature rises toward the tip
      z += Math.cos(a) * ds; y -= Math.sin(a) * ds;
    }
  }
  const thick = (i) => (T0 * Math.pow(1 - i / LIP, 0.8) + 0.025) * lerp(1.6, 1, curl);
  // back of the wave: from far behind, a long rise to the crest
  for (let i = 0; i < BACK; i++) {
    const u = i / BACK;
    const z = lerp(-40, C[0] - 0.05, Math.pow(u, 0.55));
    const d = (C[0] - z);
    const y = Hc * Math.exp(-Math.pow(d / 9.0, 1.6)) - 0.15 * (1 - Math.exp(-d / 20));
    P.push([z, y]); TH.push(3.0); PART.push(0); FOAM.push(0);
  }
  // top of the lip
  for (let i = 0; i <= LIP; i++) {
    const [z, y] = cl[i], a = ang[i], t = thick(i);
    P.push([z - Math.sin(a) * t * 0.5, y + Math.cos(a) * t * 0.5]); TH.push(t); PART.push(1);
    FOAM.push(smooth(0.9, 1, i / LIP) * 0.7 * smooth(0.05, 0.4, curl));
  }
  // round the tip: a half circle in the lip's own frame
  {
    const [z, y] = cl[LIP], a = ang[LIP], t = thick(LIP);
    const nx = -Math.sin(a), ny = Math.cos(a), tx = Math.cos(a), ty = -Math.sin(a);
    for (let k = 1; k <= TIP; k++) {
      const th = Math.PI * (k / (TIP + 1));
      P.push([z + (nx * Math.cos(th) + tx * Math.sin(th)) * t * 0.5, y + (ny * Math.cos(th) + ty * Math.sin(th)) * t * 0.5]);
      TH.push(t); PART.push(1); FOAM.push(smooth(0.05, 0.4, curl));
    }
  }
  // underside of the lip, tip back to root
  for (let i = LIP; i >= 0; i--) {
    const [z, y] = cl[i], a = ang[i], t = thick(i);
    P.push([z + Math.sin(a) * t * 0.5, y - Math.cos(a) * t * 0.5]); TH.push(t); PART.push(2);
    FOAM.push(smooth(0.94, 1, i / LIP) * 0.45 * curl);
  }
  // the face: from under the crest down to the trough, concave; it leans back under the lip as the curl grows
  {
    const top = P[P.length - 1];
    const zt = 1.35 + 0.35 * curl;                      // trough, in front of the face
    const p1 = [top[0] - 0.55 - 0.35 * curl, top[1] - 0.6];
    const p2 = [zt - 0.9 - 0.6 * curl, 0.55];
    for (let i = 1; i <= FACE; i++) {
      const u = i / FACE;
      P.push(bez(top, p1, p2, [zt, 0.0], u)); TH.push(lerp(0.6, 2.5, u)); PART.push(3);
      FOAM.push(smooth(0.93, 1, u) * 0.18 * curl);
    }
  }
  // the sea in front, out toward the beach
  {
    const z0 = P[P.length - 1][0];
    for (let i = 1; i <= FRONT; i++) {
      const u = i / FRONT;
      const z = lerp(z0, 40, Math.pow(u, 1.8));
      P.push([z, -0.12 * Math.sin(Math.min(1, (z - z0) / 6) * Math.PI) + 0.0]); TH.push(3.0); PART.push(4);
      FOAM.push(0);
    }
  }
  // collapse: past phi 1.3 the curl turns into a tumbling mound of whitewater
  const col = smooth(1.2, 1.6, phi);
  if (col > 0) {
    for (let i = 0; i < P.length; i++) {
      const [z, y] = P[i];
      const mound = 2.1 * Math.exp(-Math.pow((z - 1.4) / (z < 1.4 ? 3.2 : 2.2), 2));
      P[i] = [z, lerp(y, mound, col)];
      FOAM[i] = Math.max(FOAM[i], col * (PART[i] === 0 ? 0.25 : 0.85));
    }
  }
  return { P, TH, PART, FOAM, lipTip: P[BACK + LIP + 1 + (TIP >> 1)], curl };
}

// the swept surface: rows along x, NSEC points across
export class Wave {
  constructor(THREE, x0 = -30, x1 = 22, rows = 260) {
    this.THREE = THREE;
    this.rows = rows; this.x0 = x0; this.x1 = x1;
    const n = rows * NSEC;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    this.th = new Float32Array(n); this.part = new Float32Array(n); this.foam = new Float32Array(n); this.uv = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('thick', new THREE.BufferAttribute(this.th, 1));
    g.setAttribute('part', new THREE.BufferAttribute(this.part, 1));
    g.setAttribute('foam', new THREE.BufferAttribute(this.foam, 1));
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
    const { pos, th, part, foam, uv } = this;
    for (let r = 0; r < this.rows; r++) {
      const x = this.rowX(r, xc);
      // slow variation along the crest so the lip is not a perfect extrusion
      const w = Math.sin(x * 0.31 + 1.3) * 0.6 + Math.sin(x * 0.77 + 4.1) * 0.4;
      const s = section(phiAt(x, t) + 0.06 * Math.sin(x * 0.53), w);
      let arc = 0;
      for (let c = 0; c < NSEC; c++) {
        const i = r * NSEC + c, [z, y] = s.P[c];
        if (c > 0) { const [z0, y0] = s.P[c - 1]; arc += Math.hypot(z - z0, y - y0); }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        th[i] = s.TH[c]; part[i] = s.PART[c]; foam[i] = s.FOAM[c];
        uv[i * 2] = x; uv[i * 2 + 1] = arc;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    for (const a of ['thick', 'part', 'foam', 'uv']) this.geo.attributes[a].needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
