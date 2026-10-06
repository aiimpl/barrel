// Shading for the breaking wave and the sea around it.
// The look of a barrel from inside comes from three things:
//  - light through the lip: sunlight enters the lip's top, crosses a few centimetres of water, and leaves its
//    underside toward you. Water absorbs red far more than green or blue, so thin water glows aqua and thicker
//    water turns deep teal. Forward scattering makes it brightest when the Sun is roughly behind what you look at.
//  - streaks: the water runs up the face and over the lip, so its small ripples are stretched along the flow
//  - foam at the lip's edge, where it lands, and in the whitewater behind
export const noise = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
// true 3D value noise: plane-projected 2D noise is constant along one axis, which shows as lines toward the eye
float hash31(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3F(vec3 p, float fw){
  float s = 0., a = .5, f = 1.;
  for (int i = 0; i < 5; i++){
    float k = 1. - smoothstep(0.2, 0.55, fw * f);
    s += a * mix(0.5, vnoise3(p), k);
    p = p * 2.03 + vec3(1.7, 9.2, 4.4); f *= 2.03; a *= .5;
  }
  return s;
}
// the same, but octaves finer than the pixel (fw: the pixel's size in p's units) fade to their average instead of
// aliasing into lines that run toward the vanishing point
float fbmF(vec2 p, float fw){
  float s = 0., a = .5, f = 1.;
  for (int i = 0; i < 5; i++){
    float k = 1. - smoothstep(0.2, 0.55, fw * f);
    s += a * mix(0.5, vnoise(p), k);
    p = p * 2.03 + vec2(1.7, 9.2); f *= 2.03; a *= .5;
  }
  return s;
}
`;

export const sky = /* glsl */`
uniform vec3 uSun;
vec3 srgb2lin(vec3 c){ return pow(c / 255., vec3(2.2)); }
vec3 skyCol(vec3 d){
  float e = degrees(asin(clamp(d.y, -1., 1.)));
  vec3 c0 = srgb2lin(vec3(176, 205, 220)), c1 = srgb2lin(vec3(132, 182, 214)), c2 = srgb2lin(vec3(84, 146, 206)), c3 = srgb2lin(vec3(48, 108, 188));
  vec3 c = mix(c0, c1, smoothstep(0., 4., e));
  c = mix(c, c2, smoothstep(4., 18., e));
  c = mix(c, c3, smoothstep(18., 70., e));
  float cs = max(dot(d, uSun), 0.);
  c += vec3(1.0, 0.95, 0.85) * (pow(cs, 8.) * 0.12 + pow(cs, 120.) * 0.6);
  c += vec3(1.0, 0.97, 0.9) * smoothstep(0.99985, 0.99995, cs) * 40.;
  // big cumulus: bright tops, grey bases, low over the sea and climbing high
  vec2 q = d.xz / max(d.y + 0.12, 0.06);
  float cl = fbm(q * 0.22 + vec2(3.1, 7.2)) * 0.7 + fbm(q * 0.7 + vec2(1.3, 2.9)) * 0.3;
  float cm = smoothstep(0.45, 0.7, cl) * smoothstep(-0.02, 0.1, d.y) * (1. - smoothstep(0.55, 0.9, d.y));
  vec3 cloudCol = mix(vec3(0.55, 0.6, 0.68), vec3(1.05, 1.05, 1.03), smoothstep(0.5, 0.8, cl) * (0.6 + 0.4 * max(dot(d, uSun), 0.)));
  c = mix(c, cloudCol, cm);
  // an island's mountains on the horizon, ahead (+x) and toward the beach: steep green ridges in haze
  float az = atan(d.z, d.x);
  float ridge = 0.;
  ridge += 11.0 * pow(max(0., 1. - abs(az - 0.45) / 0.32), 1.1);
  ridge += 9.0 * pow(max(0., 1. - abs(az - 0.85) / 0.22), 1.0);
  ridge += 6.0 * pow(max(0., 1. - abs(az - 0.15) / 0.2), 1.1);
  ridge += 3.5 * pow(max(0., 1. - abs(az - 1.15) / 0.25), 1.2);
  ridge = ridge * (0.75 + 0.5 * fbm(vec2(az * 9., 1.7))) + 0.8 * fbm(vec2(az * 40., 3.3)) * step(0.3, ridge);
  ridge *= step(-0.2, az) * step(az, 1.35);
  if (e > 0. && e < ridge) {
    float k = e / max(ridge, 0.01);
    vec3 mt = mix(vec3(0.07, 0.15, 0.1), vec3(0.22, 0.32, 0.3), k * 0.5 + 0.4 * fbm(vec2(az * 30., e * 3.)));
    c = mix(c, mt, 0.9 - 0.3 * k);
  }
  if (e < 0.) c = c0 * 0.85;
  return c;
}
`;

export const waveVert = /* glsl */`
attribute float thick; attribute float part; attribute float foam; attribute float occ;
varying vec3 vW; varying vec3 vN; varying float vTh; varying float vPart; varying float vFoam; varying vec2 vUv; varying float vOcc;
void main(){
  vOcc = occ;
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vTh = thick; vPart = part; vFoam = foam; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const waveFrag = /* glsl */`
uniform float uT;
uniform vec3 uCam;
uniform vec3 uSunCol;
uniform float uDbg;
varying vec3 vW; varying vec3 vN; varying float vTh; varying float vPart; varying float vFoam; varying vec2 vUv; varying float vOcc;
${noise}
${sky}
void main(){
  vec3 v = normalize(uCam - vW);
  vec3 n = normalize(vN);
  if (dot(n, v) < 0.) n = -n;                              // both sides of the lip are seen
  // streaks: ripples stretched along the flow (arc length runs across the wave; the water runs up the face and over
  // the lip). Two scales, both moving with the water, plus a fine cross-chop.
  // how lip-like the surface is: the lip itself, and the face more so the higher up it goes (no seam where they meet)
  float px = length(fwidth(vW));
  float pu = length(fwidth(vUv));
  float lip = max(step(0.5, vPart) * step(vPart, 2.5), step(2.5, vPart) * step(vPart, 3.5) * smoothstep(1.5, 4.8, vW.y));
  // how much this point is the open sea (behind the back / in front of the trough): shaded like the sea plane
  // by height above the trough, so the face blends into the sea without a seam
  float seaK = step(2.5, vPart) * (1. - smoothstep(0.15, 1.2, vW.y));
  float spd = mix(2.2, 3.4, lip);
  // the streak pattern is warped so it never lines up into regular rings down the tube
  vec2 wp = vec2(fbm(vec2(vUv.x * 0.9, vUv.y * 0.7 - uT * 0.8)), fbm(vec2(vUv.x * 0.8 + 5.2, vUv.y * 0.6 - uT * 0.7)));
  vec2 s1 = vec2(vUv.x * 3.2 + wp.x * 3.0, vUv.y * 1.1 - uT * spd + wp.y * 1.6);
  vec2 s2 = vec2(vUv.x * 9.0 + wp.y * 5.0, vUv.y * 3.4 - uT * spd * 1.3 + wp.x * 2.5);
  float e = 0.04;
  float f1 = pu * 3.2, f2 = pu * 9.;
  float a0 = fbmF(s1, f1) + 0.45 * fbmF(s2, f2);
  float ax = fbmF(s1 + vec2(e, 0.), f1) + 0.45 * fbmF(s2 + vec2(e, 0.), f2);
  float ay = fbmF(s1 + vec2(0., e), f1) + 0.45 * fbmF(s2 + vec2(0., e), f2);
  vec3 t1 = vec3(1., 0., 0.), t2 = normalize(cross(n, t1));
  // big, slow patches so the streaks are not uniform
  float patchy = 0.45 + 1.1 * fbm(vec2(vUv.x * 0.35 + 7., vUv.y * 0.25 - uT * 0.6));
  float amp = 0.035 * (1. - lip) * patchy * (1. - seaK);
  n = normalize(n - (t1 * (ax - a0) + t2 * (ay - a0)) / e * amp);
  // the sea: world-space ripples like the open-sea plane
  {
    vec2 p = vW.xz; float es = 0.08; vec2 off = vec2(uT * 0.1, uT * 0.05);
    float g0 = fbm(p * 0.35 + off), gx = fbm((p + vec2(es, 0.)) * 0.35 + off), gz = fbm((p + vec2(0., es)) * 0.35 + off);
    vec3 ns = normalize(vec3(-(gx - g0) / es * 0.5, 1., -(gz - g0) / es * 0.5));
    n = normalize(mix(n, ns, seaK));
  }
  // fine chop, the same in every direction: three planes of noise averaged, so no direction lines up
  vec3 cw = vW * 3.5 + vec3(-uT * 3.0, uT * 1.0, 0.);
  float fc = px * 3.5;
  float ch = fbm3F(cw, fc);
  float ch2 = fbm3F(cw + vec3(5.3, 1.9, 2.4), fc);
  n = normalize(n + (t1 * (ch - 0.5) + t2 * (ch2 - 0.5)) * 0.35 * (1. - seaK));
  float streak = a0;   // also used to vary the light coming through
  // the lip's sheet is aerated and bumpy (world space, carried with the flow), not smooth
  vec3 bp = vW * 2.6 + vec3(-uT * 4.0, 0., uT * 1.5);
  float fb = px * 2.6;
  float b1 = fbm3F(bp, fb), b2 = fbm3F(bp * 1.7 + vec3(7.1, 2.2, 4.0), fb * 1.7), b3 = fbm3F(bp * 3.1 + vec3(2.3, 6.6, 1.1), fb * 3.1);
  // swirls: the water runs round the curl, so the sheet carries long soft streaks along it (filtered: no aliasing)
  float sw = fbmF(vec2(vUv.x * 1.6 + b1 * 1.5, vUv.y * 0.22 - uT * 0.9), pu * 1.6);
  n = normalize(n + (t1 * (b1 - 0.5) + t2 * (b2 - 0.5)) * 0.18 * lip + t1 * (sw - 0.5) * 0.25 * lip);
  float aer = lip * smoothstep(0.2, 0.95, b1 * 0.55 + sw * 0.45);
  float ndv = max(dot(n, v), 0.);
  float F = 0.02 + 0.98 * pow(1. - ndv, 5.);
  // under a closed lip the water reflects the tube's ceiling (dim blue), not the sky
  vec3 rd = reflect(-v, n);
  vec3 refl = mix(skyCol(rd), vec3(0.09, 0.2, 0.3) * (0.7 + 0.6 * max(rd.y, 0.)), vOcc * smoothstep(-0.1, 0.25, rd.y));
  // light through the water: thickness along the light's path, red absorbed most
  // the lip is not even: thin windows and thicker ropes run with the flow
  float thv = vTh * mix(1.0, 0.5 + 1.0 * smoothstep(0.3, 0.75, (b1 + b3) * 0.5), lip);
  float th = thv / max(abs(dot(n, uSun)), 0.25);
  vec3 sigma = vec3(4.5, 1.6, 1.3);                       // effective, per metre: reef water, blue
  vec3 trans = exp(-sigma * th);
  float cosA = dot(-uSun, v);
  float g = 0.55;
  float phase = (1. - g * g) / pow(1. + g * g - 2. * g * cosA, 1.5) / 7.7;   // 1 when looking straight into the Sun
  // what you see through a thin, moving sheet of water is broken up by its ripples
  // what comes through a moving sheet is broken up by its lumps (isotropic, so nothing lines up toward the eye)
  float lumps = (b1 + b2) * 0.5;
  vec3 glow = uSunCol * trans * (0.16 + 0.35 * phase) * (0.55 + 0.9 * smoothstep(0.3, 0.75, lumps));
  glow = min(glow, vec3(0.35, 0.6, 0.75));               // even the thinnest water keeps its colour
  // light scattered inside the water body (the deep teal of thick water), lit by the sky
  vec3 body = vec3(0.005, 0.035, 0.075) * (0.6 + 0.4 * max(n.y, 0.)) + vec3(0.03, 0.13, 0.2) * exp(-th * 0.4) * (1. + 0.6 * lip);
  vec3 col = mix(body + glow, refl, F);
  // air in the thin sheet scatters light: milky blue-white patches
  col = mix(col, vec3(0.66, 0.78, 0.84) * (0.85 + 0.25 * phase), aer * 0.6 * exp(-thv * 0.45));
  // the Sun's glints
  vec3 hdir = normalize(uSun + v);
  // glints: only the facets that catch the Sun exactly, broken up by the fine chop
  col += uSunCol * pow(max(dot(n, hdir), 0.), 1800.) * 30. * step(0.62, fbmF(vec2(vUv.x * 40., vUv.y * 33. - uT * 7.), pu * 40.));
  // foam: the lip's edge, the landing, the whitewater. Never flat paint: bubbles and clumps with shaded creases,
  // and gaps where the water shows, even where it is thick.
  float g1 = fbmF(vec2(vUv.x * 4.0, vUv.y * 4.4 - uT * 1.6), pu * 4.4);
  float g2 = fbmF(vec2(vUv.x * 17., vUv.y * 14. - uT * 2.2), pu * 17.);
  float g3 = fbmF(vec2(vUv.x * 46., vUv.y * 38. - uT * 3.0), pu * 46.);
  float cover = clamp(vFoam, 0., 1.);
  float web = 1. - abs(g2 * 2. - 1.);
  float clump = g1 * 0.55 + g2 * 0.3 + g3 * 0.25;
  float lace = mix(web * 0.75 + g3 * 0.35, clump, cover);
  float fm = smoothstep(0.8 - 0.42 * cover, 0.9 - 0.38 * cover, lace + 0.2 * cover) * smoothstep(0.03, 0.3, cover);
  // the foam's own relief: clumps catch the light, creases fall into shade
  float relief = smoothstep(0.25, 0.85, clump);
  // foam scatters light every which way: even in shade it stays a bright blue-white
  float lit = 0.62 + 0.38 * max(dot(normalize(vN), uSun), 0.);
  vec3 foamCol = mix(vec3(0.78, 0.87, 0.95), vec3(0.95, 0.98, 1.0), max(dot(normalize(vN), uSun), 0.)) * lit * mix(0.62, 1.12, relief) * (0.9 + 0.22 * g3);
  col = mix(col, foamCol, fm * mix(0.75, 1.0, cover));
  // haze with distance
  float dist = length(uCam - vW);
  col = mix(col, skyCol(normalize(vec3(-v.x, 0.02, -v.z))), 1. - exp(-dist * 0.0012));
  if (uDbg > 0.5 && uDbg < 1.5) col = normalize(vN) * 0.5 + 0.5;          // geometric normal
  if (uDbg > 1.5 && uDbg < 2.5) col = n * 0.5 + 0.5;                      // final normal
  if (uDbg > 2.5 && uDbg < 3.5) col = vec3(vTh / 3.0, vFoam, vOcc);        // attributes
  if (uDbg > 3.5 && uDbg < 4.5) col = glow;
  if (uDbg > 4.5 && uDbg < 5.5) col = vec3(fract(vTh * 4.), vTh / 3., 0.);
  if (uDbg > 5.5) col = vec3(lumps);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the open sea beyond the wave: a large plane with ripples and the sky's reflection
export const seaVert = /* glsl */`
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const seaFrag = /* glsl */`
uniform float uT; uniform vec3 uCam; uniform vec3 uSunCol;
varying vec3 vW;
${noise}
${sky}
void main(){
  vec3 v = normalize(uCam - vW);
  vec2 p = vW.xz;
  float e = 0.08;
  float h0 = fbm(p * 0.35 + vec2(uT * 0.1, uT * 0.05)), hx = fbm((p + vec2(e, 0.)) * 0.35 + vec2(uT * 0.1, uT * 0.05)), hz = fbm((p + vec2(0., e)) * 0.35 + vec2(uT * 0.1, uT * 0.05));
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.5, 1., -(hz - h0) / e * 0.5));
  float dist = length(uCam - vW);
  n = normalize(mix(n, vec3(0., 1., 0.), smoothstep(30., 400., dist)));
  float F = 0.02 + 0.98 * pow(1. - max(dot(n, v), 0.), 5.);
  vec3 col = mix(vec3(0.01, 0.06, 0.08), skyCol(reflect(-v, n)), F);
  col += uSunCol * pow(max(dot(n, normalize(uSun + v)), 0.), 400.) * 10.;
  col = mix(col, skyCol(normalize(vec3(-v.x, 0.01, -v.z))), 1. - exp(-dist * 0.0012));
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const skyVert = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.); gl_Position = p.xyww; }`;
export const skyFrag = /* glsl */`
varying vec3 vDir;
${noise}
${sky}
void main(){ gl_FragColor = vec4(skyCol(normalize(vDir)), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
