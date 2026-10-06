// BARREL — inside a breaking wave, in three.js.
//   (no query)  the ride loops; drag to look around        ?render  frame by frame (__renderAt, tools/render.py)
//   ?t=<s> a moment   ?cam=px,py,pz,ax,ay,az,fov  a fixed camera relative to the rider (for checking)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Wave, breakX, LPHI, SCALE, BEND, bendZ, PEAK } from './wave.js';
import { waveVert, waveFrag, seaVert, seaFrag, skyVert, skyFrag } from './water.js';
import { Spray } from './spray.js';

const q = new URLSearchParams(location.search);
const RENDER = q.has('render');
const canvas = document.getElementById('c');
document.getElementById('note').textContent = 'three.js · real-time in a browser';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(q.has('rs') ? +q.get('rs') : Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 40000);

// the Sun: on the beach side and ahead, so it shines through the lip toward a rider inside
const SUN = new THREE.Vector3(0.25, 0.92, 0.32).normalize();
const U = { uMilk: { value: 1 }, uDbg: { value: +(new URLSearchParams(location.search).get('dbg') || 0) }, uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: SUN }, uSunCol: { value: new THREE.Color(1.0, 0.97, 0.93).multiplyScalar(2.4) } };

const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(35000, 48, 24), new THREE.ShaderMaterial({ uniforms: U, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }));
skyMesh.renderOrder = -10;
scene.add(skyMesh);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: seaVert, fragmentShader: seaFrag }));
sea.position.y = -0.05;
scene.add(sea);
const wave = new Wave(THREE);
const waveMesh = new THREE.Mesh(wave.geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: waveVert, fragmentShader: waveFrag, side: THREE.DoubleSide }));
waveMesh.frustumCulled = false;
scene.add(waveMesh);
const spray = new Spray(THREE);
spray.u.uSun.value = SUN; spray.u.uSunCol.value = U.uSunCol.value;
scene.add(spray.points); if (q.has('nospray')) spray.points.visible = false;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.35, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// the action camera: a wide lens's barrel distortion, a touch of colour fringing, and water drops on the lens
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uK: { value: 0.0 }, uDrops: { value: 0 }, uT: { value: 0 }, uAspect: { value: 16 / 9 }, uMist: { value: 0 }, uFlip: { value: +(q.get('flip') || 1) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uK, uDrops, uT, uAspect, uMist, uFlip; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5; c.x *= uAspect * uFlip;
      float r2 = dot(c, c);
      vec2 d = c * (1. + uK * r2) / (1. + uK * (0.25 * uAspect * uAspect + 0.25));   // fisheye: edges squeezed, corners stay corners
      // drops: a few dozen lenses on the glass, each bending the view and bright at its rim
      vec2 off = vec2(0.); float rim = 0.;
      for (int i = 0; i < 40; i++) {
        float fi = float(i);
        vec2 dp = vec2(h(vec2(fi, 1.)) - 0.5, h(vec2(fi, 2.)) - 0.5) * vec2(uAspect, 1.) * 0.95;
        dp.y -= uT * 0.02 * h(vec2(fi, 5.));            // slide down slowly
        float rad = (0.015 + 0.05 * h(vec2(fi, 3.))) * step(h(vec2(fi, 4.)), uDrops);
        vec2 q = c - dp; float l = length(q);
        float m = smoothstep(rad, rad * 0.6, l);
        off += -q / max(rad, 1e-3) * m * 0.022;
        rim += smoothstep(rad * 0.55, rad * 0.9, l) * m;
      }
      vec2 uvc = d; uvc.x /= uAspect; uvc += 0.5 + off;
      float ca = 0.0005 * r2 * 3.;
      vec3 col = vec3(texture2D(tDiffuse, uvc + c * ca).r, texture2D(tDiffuse, uvc).g, texture2D(tDiffuse, uvc - c * ca).b);
      col = mix(col, col * 1.04 + 0.006, rim * 0.3);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.0);
      col = col * 0.97 + vec3(0.008, 0.012, 0.016);
      col = mix(col, col * vec3(0.96, 1.02, 0.95) + vec3(0.01, 0.02, 0.0), smoothstep(0.6, 1.1, length(c)));
      // the spit: a wall of mist, thicker at the edges of the frame, with a little structure
      float mn = sin(vUv.x * 11. + uT * 2.1) * sin(vUv.y * 7. - uT * 1.6) * 0.05 + sin(vUv.x * 29. - uT * 3.) * sin(vUv.y * 23. + uT * 2.4) * 0.025;
      col = mix(col, vec3(0.86, 0.92, 0.96) * (0.92 + mn), uMist * (0.55 + 0.45 * smoothstep(0.1, 0.8, length(c))));
      col *= mix(1.0, 0.62, smoothstep(0.35, 1.0, length(c)));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(lens);

// The shot: a camera low in the water facing the beach. The lip pitches over it and lands in front, the camera is
// shut inside for a moment with only a small window open ahead-left, then it is carried out through that window
// as the wave runs on. Each path is keyframes [time, value], eased through (no stops at the keys).
export const LEN = 10.0;
const ss = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
function kf(K, t) {
  if (t <= K[0][0]) return K[0][1];
  const n = K.length - 1;
  if (t >= K[n][0]) return K[n][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const [t0, v0] = K[i], [t1, v1] = K[i + 1], h = t1 - t0, u = (t - t0) / h;
  const m = (j) => (j <= 0 || j >= n ? 0 : (K[j + 1][1] - K[j - 1][1]) / (K[j + 1][0] - K[j - 1][0]) * h);
  const m0 = m(i), m1 = m(i + 1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
}
// how far the curl has gone where the camera is
const PHI = [[0, 0.36], [3.0, 0.5], [3.4, 0.62], [4.0, 0.84], [4.6, 1.1], [5.4, 1.25], [6.0, 0.98], [6.6, 0.78], [7.2, 0.58], [7.8, 0.45], [8.5, 0.35], [10, 0.3]];
// where the camera is across the wave (z, toward the beach) and its height: out in front while the lip throws,
// swept back under it as the wave comes on, then carried forward out through the window
const CZ = [[0, 5.2], [3.2, 5.0], [4.3, 4.7], [6.0, 4.6], [6.6, 4.8], [7.2, 5.6], [7.8, 8.0], [8.5, 12.0], [10, 15.0]];
const CY = [[0, 1.0], [3.2, 1.05], [4.3, 0.95], [6.0, 0.9], [7.0, 1.0], [8.5, 1.1], [10, 1.1]];
// where it looks: yaw from the beach toward the open end (+x), pitch up
const YAW = [[0, 0.75], [3.2, 0.8], [4.3, 0.95], [6.0, 1.0], [6.6, 1.0], [7.2, 0.95], [7.8, 0.6], [8.5, 0.3], [10, 0.25]];
const PITCH = [[0, 0.22], [3.2, 0.24], [4.3, 0.16], [6.0, 0.1], [7.0, 0.08], [8.5, 0.06], [10, 0.06]];
const ROLL = [[0, -0.2], [4.3, -0.16], [7.2, -0.12], [8.5, -0.22], [10, -0.24]];
const ridePhi = (t) => kf(PHI, t);
// how strongly the lip ahead-left throws before the rest (the slanted edge as it comes over)
const PEAKA = [[0, 0], [10, 0]];
const PEAK_OFF = 12, PEAK_W = 10;
const PEAKB = [[0, 0], [10, 0]];
const peakAt = (t) => kf(PEAKA, t) * Math.tanh(-PEAK_OFF / PEAK_W) + kf(PEAKB, t) * (Math.tanh(1) - 1) * 0.5;   // the steps' value at the camera
const PHIQ = q.get('phi'); const ridePhiQ = PHIQ ? () => +PHIQ : ridePhi;
// the camera's own curl is PHI; the reef's step (PEAK) is undone at the camera so PHI stays what it says
const riderX = (t) => breakX(t) - (ridePhiQ(t) - peakAt(t)) * LPHI;
BEND.x0 = riderX(4.5);   // the reef bends the wave toward the beach ahead of the camera
const CAMQ = q.get('cam') && q.get('cam').split(',').map(Number);
const look = { yaw: 0, pitch: 0, held: false };
if (!RENDER) {
  let px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => { look.held = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!look.held) return;
    look.yaw = Math.max(-1.6, Math.min(1.6, look.yaw - (e.clientX - px) * 0.004));
    look.pitch = Math.max(-0.9, Math.min(0.9, look.pitch - (e.clientY - py) * 0.004));
    px = e.clientX; py = e.clientY;
  });
  const up = () => { look.held = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  setInterval(() => { if (!look.held) { look.yaw *= 0.94; look.pitch *= 0.94; } }, 16);
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

let headYaw = 0, headPitch = 0;
// shake of a camera on a surfer: a sum of sways at several rates (deterministic, so any frame can be drawn alone),
// plus short jolts where the board slaps the chop. Amplitudes set so the optical flow matches the reference POV.
const SHAKE = { amp: 1.3 };
function shake(t) {
  const s = (f, p) => Math.sin(t * f * 6.2832 + p);
  const yaw = 0.010 * s(0.7, 1.1) + 0.007 * s(1.9, 2.3) + 0.004 * s(3.7, 0.4) + 0.0025 * s(6.1, 5.0);
  const pitch = 0.012 * s(0.9, 0.2) + 0.008 * s(2.3, 4.1) + 0.005 * s(4.3, 1.7) + 0.003 * s(7.3, 2.9);
  const roll = 0.03 * s(0.45, 3.3) + 0.012 * s(1.6, 0.9) + 0.006 * s(3.1, 2.2);
  // jolts: a quick kick that settles, every 0.6-1.4 s
  let jolt = 0;
  for (let k = 0; k < 18; k++) {
    const at = k * 0.95 + 0.4 * Math.sin(k * 12.9898);
    const d = t - at;
    if (d > 0 && d < 0.5) jolt += (0.012 + 0.01 * Math.abs(Math.sin(k * 78.233))) * Math.exp(-d * 9) * Math.sin(d * 38);
  }
  const lift = 0.06 * s(1.3, 0.6) + 0.035 * s(2.9, 2.0) + jolt * 2.5;
  return { yaw: yaw * SHAKE.amp, pitch: (pitch + jolt) * SHAKE.amp, roll: roll * SHAKE.amp, lift: lift * SHAKE.amp };
}
function placeCamera(t) {
  let x = riderX(t), pos, aim, fov = 108, roll = 0;
  headYaw = 0; headPitch = 0;
  lens.uniforms.uK.value = 0.5;
  if (CAMQ) {
    pos = v3(x + CAMQ[0], CAMQ[1], CAMQ[2]); aim = v3(x + CAMQ[3], CAMQ[4], CAMQ[5]); fov = CAMQ[6] || 70;
  } else {
    pos = v3(x, kf(CY, t), kf(CZ, t) + bendZ(x));
    const yaw = kf(YAW, t) + +(q.get('yo') || 0), pitch = kf(PITCH, t) + +(q.get('po') || 0);
    aim = pos.clone().add(v3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
    roll = kf(ROLL, t);
  }
  camera.position.copy(pos);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(aim);
  // the viewer's drag turns the head (page only); it eases back when let go
  if (look.yaw || look.pitch) { camera.rotateY(look.yaw); camera.rotateX(look.pitch); }
  if (headYaw || headPitch) { camera.rotateY(headYaw); camera.rotateX(headPitch); }
  if (roll) camera.rotateZ(roll);
  const sh = shake(t);
  camera.position.y += sh.lift;
  camera.rotateY(sh.yaw); camera.rotateX(sh.pitch); camera.rotateZ(sh.roll);
  return x;
}

function frame(t) {
  const x = placeCamera(t);
  PEAK.x0 = x; PEAK.amp = q.has('pa') ? +q.get('pa') : kf(PEAKA, t); PEAK.off = PEAK_OFF; PEAK.w = PEAK_W; PEAK.back = kf(PEAKB, t);
  wave.update(t, x);
  // two spits: one blows the rider out (9.6-12 s), one comes out of the tube while we look back (15.5-18.5 s)
  spray.update(t, riderX(t), 0);
  lens.uniforms.uT.value = t;
  lens.uniforms.uMist.value = 0.3 * ss(6.5, 6.9, t) * (1 - ss(7.0, 7.6, t));
  lens.uniforms.uDrops.value = 0;
  spray.u.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  U.uT.value = t;
  U.uMilk.value = 0.35 + 0.65 * ss(3.4, 4.3, t) * (1 - ss(7.0, 7.8, t));
  U.uCam.value.copy(camera.position);
  skyMesh.position.copy(camera.position);
  composer.render();
  return { t, x };
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
window.__filmLen = LEN;
window.__cam = camera;
window.__renderAt = async (f, fps) => { const r = frame(f / fps); renderer.getContext().finish(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); return r; };
if (RENDER || q.has('t')) frame(+(q.get('t') || 0));
else { let T = 0, last = performance.now(); renderer.setAnimationLoop(() => { const now = performance.now(); T = (T + (now - last) / 1000) % LEN; last = now; frame(T); }); }
window.__ready = true;
