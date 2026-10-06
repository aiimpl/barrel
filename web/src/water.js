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
  // a few soft clouds low over the sea
  vec2 q = d.xz / max(d.y + 0.08, 0.04);
  float cl = smoothstep(0.55, 0.85, fbm(q * 0.35 + vec2(3.1, 7.2))) * smoothstep(0.0, 0.08, d.y) * (1. - smoothstep(0.3, 0.6, d.y));
  c = mix(c, vec3(0.95, 0.96, 0.98) * 0.9, cl * 0.6);
  if (e < 0.) c = c0 * 0.85;
  return c;
}
`;

export const waveVert = /* glsl */`
attribute float thick; attribute float part; attribute float foam;
varying vec3 vW; varying vec3 vN; varying float vTh; varying float vPart; varying float vFoam; varying vec2 vUv;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vTh = thick; vPart = part; vFoam = foam; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const waveFrag = /* glsl */`
uniform float uT;
uniform vec3 uCam;
uniform vec3 uSunCol;
varying vec3 vW; varying vec3 vN; varying float vTh; varying float vPart; varying float vFoam; varying vec2 vUv;
${noise}
${sky}
void main(){
  vec3 v = normalize(uCam - vW);
  vec3 n = normalize(vN);
  if (dot(n, v) < 0.) n = -n;                              // both sides of the lip are seen
  // streaks: ripples stretched along the flow (arc length runs across the wave; the water runs up the face and over
  // the lip). Two scales, both moving with the water, plus a fine cross-chop.
  float lip = step(0.5, vPart) * step(vPart, 2.5);
  // how much this point is the open sea (behind the back / in front of the trough): shaded like the sea plane
  float seaK = (1. - smoothstep(0.0, 0.6, abs(vPart - 4.))) * smoothstep(1.0, 6.0, vUv.y - 0.) ;
  float spd = mix(2.2, 3.4, lip);
  // the streak pattern is warped so it never lines up into regular rings down the tube
  vec2 wp = vec2(fbm(vec2(vUv.x * 0.9, vUv.y * 0.7 - uT * 0.8)), fbm(vec2(vUv.x * 0.8 + 5.2, vUv.y * 0.6 - uT * 0.7)));
  vec2 s1 = vec2(vUv.x * 3.2 + wp.x * 3.0, vUv.y * 1.1 - uT * spd + wp.y * 1.6);
  vec2 s2 = vec2(vUv.x * 9.0 + wp.y * 5.0, vUv.y * 3.4 - uT * spd * 1.3 + wp.x * 2.5);
  float e = 0.04;
  float a0 = fbm(s1) + 0.45 * fbm(s2);
  float ax = fbm(s1 + vec2(e, 0.)) + 0.45 * fbm(s2 + vec2(e, 0.));
  float ay = fbm(s1 + vec2(0., e)) + 0.45 * fbm(s2 + vec2(0., e));
  vec3 t1 = vec3(1., 0., 0.), t2 = normalize(cross(n, t1));
  // big, slow patches so the streaks are not uniform
  float patchy = 0.45 + 1.1 * fbm(vec2(vUv.x * 0.35 + 7., vUv.y * 0.25 - uT * 0.6));
  float amp = mix(0.06, 0.11, lip) * patchy * (1. - seaK);
  n = normalize(n - (t1 * (ax - a0) + t2 * (ay - a0)) / e * amp);
  // the sea: world-space ripples like the open-sea plane
  {
    vec2 p = vW.xz; float es = 0.08; vec2 off = vec2(uT * 0.1, uT * 0.05);
    float g0 = fbm(p * 0.35 + off), gx = fbm((p + vec2(es, 0.)) * 0.35 + off), gz = fbm((p + vec2(0., es)) * 0.35 + off);
    vec3 ns = normalize(vec3(-(gx - g0) / es * 0.5, 1., -(gz - g0) / es * 0.5));
    n = normalize(mix(n, ns, seaK));
  }
  // fine chop, the same in every direction (world space, moving with the water)
  vec2 cp = vec2(vW.x * 6. + vW.z * 3., vW.y * 6. - uT * 4.);
  float ch = fbm(cp), ch2 = fbm(cp + vec2(4.3, 1.7));
  n = normalize(n + (t1 * (ch - 0.5) + t2 * (ch2 - 0.5)) * 0.16 * (1. - seaK));
  float streak = a0;   // also used to vary the light coming through
  float ndv = max(dot(n, v), 0.);
  float F = 0.02 + 0.98 * pow(1. - ndv, 5.);
  vec3 refl = skyCol(reflect(-v, n));
  // light through the water: thickness along the light's path, red absorbed most
  // the lip is not even: thin windows and thicker ropes run with the flow
  float thv = vTh * mix(1.0, 0.45 + 1.1 * smoothstep(0.3, 1.2, a0), lip);
  float th = thv / max(abs(dot(n, uSun)), 0.25);
  vec3 sigma = vec3(9.0, 2.2, 2.8);                       // effective, per metre: clear water plus what it carries
  vec3 trans = exp(-sigma * th);
  float cosA = dot(-uSun, v);
  float g = 0.55;
  float phase = (1. - g * g) / pow(1. + g * g - 2. * g * cosA, 1.5) / 7.7;   // 1 when looking straight into the Sun
  // what you see through a thin, moving sheet of water is broken up by its ripples
  vec3 glow = uSunCol * trans * (0.12 + 0.7 * phase) * (0.6 + 0.8 * smoothstep(0.35, 1.1, streak));
  // light scattered inside the water body (the deep teal of thick water), lit by the sky
  vec3 body = vec3(0.006, 0.05, 0.06) * (0.6 + 0.4 * max(n.y, 0.)) + vec3(0.02, 0.12, 0.12) * exp(-th * 0.6);
  vec3 col = mix(body + glow, refl, F);
  // the Sun's glints
  vec3 hdir = normalize(uSun + v);
  // glints: only the facets that catch the Sun exactly, broken up by the fine chop
  col += uSunCol * pow(max(dot(n, hdir), 0.), 1800.) * 30. * step(0.62, fbm(vec2(vUv.x * 40., vUv.y * 33. - uT * 7.)));
  // foam: the lip's edge, the landing, the whitewater. Never flat paint: bubbles and clumps with shaded creases,
  // and gaps where the water shows, even where it is thick.
  float f1 = fbm(vec2(vUv.x * 4.0, vUv.y * 4.4 - uT * 1.6));
  float f2 = fbm(vec2(vUv.x * 17., vUv.y * 14. - uT * 2.2));
  float f3 = fbm(vec2(vUv.x * 46., vUv.y * 38. - uT * 3.0));
  float cover = clamp(vFoam, 0., 1.);
  float web = 1. - abs(f2 * 2. - 1.);
  float clump = f1 * 0.55 + f2 * 0.3 + f3 * 0.25;
  float lace = mix(web * 0.75 + f3 * 0.35, clump, cover);
  float fm = smoothstep(0.8 - 0.42 * cover, 0.9 - 0.38 * cover, lace + 0.2 * cover) * smoothstep(0.03, 0.3, cover);
  // the foam's own relief: clumps catch the light, creases fall into shade
  float relief = smoothstep(0.25, 0.85, clump);
  // foam scatters light every which way: even in shade it stays a bright blue-white
  float lit = 0.62 + 0.38 * max(dot(normalize(vN), uSun), 0.);
  vec3 foamCol = mix(vec3(0.78, 0.87, 0.95), vec3(0.95, 0.98, 1.0), max(dot(normalize(vN), uSun), 0.)) * lit * mix(0.62, 1.12, relief) * (0.9 + 0.22 * f3);
  col = mix(col, foamCol, fm * mix(0.75, 1.0, cover));
  // haze with distance
  float dist = length(uCam - vW);
  col = mix(col, skyCol(normalize(vec3(-v.x, 0.02, -v.z))), 1. - exp(-dist * 0.0012));
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
