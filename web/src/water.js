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
  // big cumulus heaped over the island: drawn in azimuth and elevation (so they stand up from the horizon, not
  // smeared flat), lit from above: where the cloud thins upward its edge is bright, its belly grey
  {
    float h = clamp(e / 55., 0., 1.);
    // on the sky dome itself (3D noise of the direction): no streaks toward the zenith; squashed a little vertically
    // near the horizon so the heaps stand in rows there
    vec3 dp = vec3(d.x, d.y * 1.6, d.z) * 2.0;
    float den = fbm3F(dp + vec3(3.1, 0., 1.7), 0.) * 0.7 + fbm3F(dp * 3.3 + vec3(1.3, 2.9, 0.4), 0.) * 0.3;
    vec3 du = dp + vec3(0., 0.12, 0.);
    float up = fbm3F(du + vec3(3.1, 0., 1.7), 0.) * 0.7 + fbm3F(du * 3.3 + vec3(1.3, 2.9, 0.4), 0.) * 0.3;
    float thr = 0.44 + 0.08 * h;
    float cm = smoothstep(thr, thr + 0.06, den) * smoothstep(-0.5, 2.5, e);
    float lit = clamp(0.55 + (den - up) * 6. + 0.35 * h, 0., 1.);
    vec3 cloudCol = mix(srgb2lin(vec3(128, 140, 158)), vec3(1.12, 1.1, 1.06), lit) * (0.85 + 0.25 * max(dot(d, uSun), 0.));
    c = mix(c, cloudCol, cm);
  }
  // the island across the lagoon, filling the view toward the beach: a far range in haze, a near range of steep
  // dark-green ridges in front of it, cloud sitting on the peaks, and the reef's white line at their foot
  float az = atan(d.z, d.x);
  float span = smoothstep(-0.5, -0.1, az) * (1. - smoothstep(2.6, 3.05, az));
  float f1 = fbm(vec2(az * 1.7, 0.5)), f2 = vnoise(vec2(az * 7.0, 2.3)) * 0.7 + vnoise(vec2(az * 15.0, 6.1)) * 0.3, f3 = vnoise(vec2(az * 40., 4.1));
  float sharp = 1. - abs(f2 * 2. - 1.);
  float near = 1.9 * (2.0 + 8.0 * smoothstep(0.3, 0.75, f1) + 2.0 * sharp * sharp * smoothstep(0.3, 0.6, f1) + 0.1 * f3) * span;
  float far = 1.3 * (5.0 + 8.0 * smoothstep(0.25, 0.7, fbm(vec2(az * 1.7, 7.7))) + 0.2 * f3) * span;
  if (e > 0. && e < far) {
    float k = e / far;
    vec3 fm = mix(srgb2lin(vec3(112, 132, 150)), srgb2lin(vec3(150, 168, 182)), k * 0.6 + 0.2 * fbm(vec2(az * 20., e * 2.)));
    c = mix(c, fm, 0.85 - 0.25 * k);
  }
  if (e > 0. && e < near) {
    float k = e / near;
    float lit = fbm(vec2(az * 60., e * 4.));
    vec3 mt = mix(srgb2lin(vec3(36, 56, 66)), srgb2lin(vec3(62, 92, 80)), smoothstep(0.35, 0.8, lit) * (0.4 + 0.6 * k));
    mt = mix(srgb2lin(vec3(100, 122, 142)), mt, 0.45 + 0.45 * k);       // haze thicker at the foot
    c = mix(c, mt, 0.95);
  }
  // cloud caught on the peaks
  float cap = smoothstep(near + 1.5, near - 1.0, e) * smoothstep(near * 0.6, near, e) * smoothstep(0.45, 0.75, fbm(vec2(az * 12., e * 0.6 + 3.)));
  c = mix(c, vec3(0.62, 0.68, 0.74), cap * 0.25 * span);
  // the reef: a thin broken white line on the lagoon at the foot of the island
  float reef = smoothstep(0.3, 0.05, abs(e - 0.15)) * (0.5 + 0.5 * fbm(vec2(az * 30., 1.))) * span;
  c = mix(c, vec3(0.85, 0.9, 0.92), reef * 0.8);
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
uniform float uMilk;   // how much air shows in the lip: full from inside the tube, less seen from outside
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
  float amp = 0.018 * (1. - lip) * patchy * (1. - seaK);
  n = normalize(n - (t1 * (ax - a0) + t2 * (ay - a0)) / e * amp);
  // the sea: world-space ripples like the open-sea plane
  {
    vec2 p = vW.xz; float es = 0.08; vec2 off = vec2(uT * 0.05, uT * 0.025);
    float g0 = fbm(p * 0.35 + off), gx = fbm((p + vec2(es, 0.)) * 0.35 + off), gz = fbm((p + vec2(0., es)) * 0.35 + off);
    vec3 ns = normalize(vec3(-(gx - g0) / es * 0.14, 1., -(gz - g0) / es * 0.14));
    n = normalize(mix(n, ns, seaK));
  }
  // fine chop, the same in every direction: three planes of noise averaged, so no direction lines up
  vec3 cw = vW * 3.5 + vec3(-uT * 3.0, uT * 1.0, 0.);
  float fc = px * 3.5;
  float ch = fbm3F(cw, fc);
  float ch2 = fbm3F(cw + vec3(5.3, 1.9, 2.4), fc);
  float ch3 = fbm3F(cw * 2.3 + vec3(1.1, 7.7, 3.3), fc * 2.3), ch4 = fbm3F(cw * 2.3 + vec3(8.2, 0.4, 5.9), fc * 2.3);
  n = normalize(n + (t1 * (ch - 0.5) + t2 * (ch2 - 0.5)) * 0.3 * (1. - seaK) + (t1 * (ch3 - 0.5) + t2 * (ch4 - 0.5)) * 0.25 * lip);
  float streak = a0;   // also used to vary the light coming through
  // the lip's sheet is aerated and bumpy (world space, carried with the flow), not smooth
  // the sheet surges: its speed varies in patches that travel with it
  float surge = 0.6 + 0.9 * fbmF(vec2(vUv.x * 0.15 + uT * 0.4, vUv.y * 0.12 - uT * 0.3), pu * 0.15);
  vec3 bp = vW * 1.3 + vec3(-uT * 5.2 * surge, uT * 2.2 * (surge - 0.6), uT * 1.6);
  float fb = px * 1.3;
  float b1 = fbm3F(bp, fb), b2 = fbm3F(bp * 1.7 + vec3(7.1, 2.2, 4.0), fb * 1.7), b3 = fbm3F(bp * 3.1 + vec3(2.3, 6.6, 1.1), fb * 3.1);
  // swirls: the water runs round the curl, so the sheet carries long soft streaks along it (filtered: no aliasing)
  float sw = fbmF(vec2(vUv.x * 1.6 + b1 * 1.5, vUv.y * 0.22 - uT * 2.6 * surge), pu * 1.6);
  n = normalize(n + (t1 * (b1 - 0.5) + t2 * (b2 - 0.5)) * 0.07 * lip + t1 * (sw - 0.5) * 0.015 * lip);
  float aer = lip * (0.3 + 0.45 * smoothstep(0.25, 0.85, b1 * 0.85 + b3 * 0.15));
  float ndv = max(dot(n, v), 0.);
  float F = 0.02 + 0.98 * pow(1. - ndv, 5.);
  // under a closed lip the water reflects the tube's ceiling (dim blue), not the sky
  vec3 rd = reflect(-v, n);
  vec3 refl = mix(skyCol(rd), vec3(0.09, 0.2, 0.3) * (0.7 + 0.6 * max(rd.y, 0.)), vOcc * smoothstep(-0.1, 0.25, rd.y)) * mix(1., 0.42, seaK);
  // light through the water: thickness along the light's path, red absorbed most
  // the lip is not even: thin windows and thicker ropes run with the flow
  float thv = vTh * mix(1.0, 0.75 + 0.5 * smoothstep(0.3, 0.75, (b1 + b3) * 0.5), lip);
  float th = thv / max(abs(dot(normalize(vN), uSun)), 0.4);   // path length from the smooth sheet, not the ripples
  vec3 sigma = vec3(4.5, 2.1, 1.2);                       // effective, per metre: reef water, blue
  vec3 trans = exp(-sigma * th);
  float cosA = dot(-uSun, v);
  float g = 0.55;
  float phase = (1. - g * g) / pow(1. + g * g - 2. * g * cosA, 1.5) / 7.7;   // 1 when looking straight into the Sun
  // what you see through a thin, moving sheet of water is broken up by its ripples
  // what comes through a moving sheet is broken up by its lumps (isotropic, so nothing lines up toward the eye)
  float lumps = (b1 + b2) * 0.5;
  vec3 glow = uSunCol * trans * (0.16 + 0.35 * phase) * (0.85 + 0.3 * smoothstep(0.3, 0.75, lumps));
  // the ripples bend the light coming through: fine bright and dark flecks, the same in every direction
  glow *= mix(1., clamp(0.95 + 0.9 * (ch - 0.5) + 0.5 * (ch3 - 0.5), 0.6, 1.4), lip);
  glow = min(glow, vec3(0.3, 0.62, 0.72));               // even the thinnest water keeps its colour
  // light scattered inside the water body (the deep teal of thick water), lit by the sky
  vec3 body = vec3(0.02, 0.05, 0.12) * (0.7 + 0.3 * max(n.y, 0.)) + vec3(0.03, 0.1, 0.2) * exp(-th * 0.4) * (1. + 0.6 * lip);
  vec3 col = mix(body + glow, refl, F);
  // air in the thin sheet scatters light: milky blue-white patches
  col = mix(col, vec3(0.66, 0.72, 0.72) * (0.9 + 0.1 * b1 + 0.1 * b3) * (0.9 + 0.2 * phase), (0.08 + 0.5 * aer) * lip * exp(-thv * 0.35) * uMilk);
  // the ripples' relief over the whole sheet (light bent and shaded by them)
  col *= mix(1., clamp(0.97 + 0.5 * (ch - 0.5) + 0.25 * (ch3 - 0.5), 0.78, 1.15), lip * 0.8);
  // the Sun's glints
  vec3 hdir = normalize(uSun + v);
  // glints: only the facets that catch the Sun exactly, broken up by the fine chop
  col += uSunCol * pow(max(dot(n, hdir), 0.), 1800.) * 12. * step(0.62, fbmF(vec2(vUv.x * 40., vUv.y * 33. - uT * 7.), pu * 40.));
  // foam: the lip's edge, the landing, the whitewater. Never flat paint: bubbles and clumps with shaded creases,
  // and gaps where the water shows, even where it is thick.
  float g1 = fbmF(vec2(vUv.x * 9.0, vUv.y * 9.0 - uT * 2.4), pu * 9.);
  float g2 = fbmF(vec2(vUv.x * 36., vUv.y * 30. - uT * 3.2), pu * 36.);
  float g3 = fbmF(vec2(vUv.x * 90., vUv.y * 76. - uT * 4.0), pu * 90.);
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
  col = mix(col, foamCol, fm * mix(0.45, 0.8, cover));
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
  vec2 so = vec2(uT * 0.2, uT * 0.1);
  float h0 = fbm(p * 1.4 + so) + 0.5 * fbm(p * 4.3 - so * 1.7), hx = fbm((p + vec2(e, 0.)) * 1.4 + so) + 0.5 * fbm((p + vec2(e, 0.)) * 4.3 - so * 1.7), hz = fbm((p + vec2(0., e)) * 1.4 + so) + 0.5 * fbm((p + vec2(0., e)) * 4.3 - so * 1.7);
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.16, 1., -(hz - h0) / e * 0.16));
  float dist = length(uCam - vW);
  n = normalize(mix(n, vec3(0., 1., 0.), smoothstep(30., 400., dist)));
  float F = 0.02 + 0.98 * pow(1. - max(dot(n, v), 0.), 5.);
  vec3 col = mix(vec3(0.015, 0.045, 0.11), skyCol(reflect(-v, n)) * 0.32, F);
  col += uSunCol * pow(max(dot(n, normalize(uSun + v)), 0.), 400.) * 3.;
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
