// BARREL — inside a breaking wave, in three.js.
//   (no query)  the ride loops; drag to look around        ?render  frame by frame (__renderAt, tools/render.py)
//   ?t=<s> a moment   ?cam=px,py,pz,ax,ay,az,fov  a fixed camera relative to the rider (for checking)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Wave, breakX, LPHI, SCALE } from './wave.js';
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
const SUN = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
const U = { uWake: { value: 0 }, uDbg: { value: +(new URLSearchParams(location.search).get('dbg') || 0) }, uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: SUN }, uSunCol: { value: new THREE.Color(1.0, 0.97, 0.93).multiplyScalar(2.4) } };

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
  uniforms: { tDiffuse: { value: null }, uK: { value: 0.0 }, uDrops: { value: 0 }, uT: { value: 0 }, uAspect: { value: 16 / 9 }, uMist: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uK, uDrops, uT, uAspect, uMist; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5; c.x *= uAspect;
      float r2 = dot(c, c);
      vec2 d = c * (1. + uK * r2) / (1. + uK * (0.25 * uAspect * uAspect + 0.25));   // fisheye: edges squeezed (not stretched, which smears everything radially), corners stay corners
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
      col = mix(vec3(lum), col, 0.78);
      col = col * 0.94 + vec3(0.02, 0.03, 0.035);
      col = mix(col, col * vec3(0.96, 1.02, 0.95) + vec3(0.01, 0.02, 0.0), smoothstep(0.6, 1.1, length(c)));
      // the spit: a wall of mist, thicker at the edges of the frame, with a little structure
      float mn = sin(vUv.x * 11. + uT * 2.1) * sin(vUv.y * 7. - uT * 1.6) * 0.05 + sin(vUv.x * 29. - uT * 3.) * sin(vUv.y * 23. + uT * 2.4) * 0.025;
      col = mix(col, vec3(0.86, 0.92, 0.96) * (0.92 + mn), uMist * (0.55 + 0.45 * smoothstep(0.1, 0.8, length(c))));
      col *= mix(1.0, 0.62, smoothstep(0.35, 1.0, length(c)));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(lens);

// the rider: inside the tube at curl phi (just behind where the lip lands, so the tube is overhead). Deeper (bigger
// phi) as the ride goes on, so the eye ahead closes in; then the spit blows the rider out through the eye.
export const LEN = 14.5;
const ss = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
// deep in the tube at the start; the eye grows as the rider closes on it; the spit blows the rider out (9.5-12 s)
const ridePhi = (t) => 1.24 - 0.24 * ss(0, 10.5, t) - 0.75 * ss(10.6, 12.6, t);
const riderX = (t) => breakX(t) - ridePhi(t) * LPHI;
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
const PEEL_AHEAD = 15.0;  // the rider, once out, outruns the peel onto the shoulder, where the wave beside is lower
function placeCamera(t) {
  let x = riderX(t), pos, aim, fov = 72, roll = 0;
  headYaw = 0; headPitch = 0;
  if (CAMQ) {
    pos = v3(x + CAMQ[0], CAMQ[1], CAMQ[2]); aim = v3(x + CAMQ[3], CAMQ[4], CAMQ[5]); fov = CAMQ[6] || 70;
  } else {
    // one continuous move (no switch of cameras, which jumped at 13 s): down the tube toward the eye, blown out
    // through it by the spit (10.6-12.6 s), then carried off the face onto the flat water, slowing down
    const out = ss(10.6, 12.6, t), away = ss(12.6, 14.5, t);
    if (t >= 13.0) {
      const v0 = (riderX(13.0) - riderX(12.95)) / 0.05;  // keep the speed it had, easing down to PEEL_AHEAD
      const dt = t - 13.0, k = ss(13.0, 14.5, t);
      x = riderX(13.0) + dt * (v0 + (PEEL_AHEAD - v0) * k * 0.6);
    }
    const calm = 1 - away;                              // the bob of riding fades once out on the flat
    const bob = (0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.1 + 1)) * calm;
    pos = v3(x, 0.8 + bob + 0.4 * out + 0.4 * away, 4.1 + 0.08 * Math.sin(t * 1.7) * calm + 1.5 * out + 4.5 * away);
    aim = v3(x + 12, 3.6 - 1.2 * out + 1.6 * away, 6.6 + 1.0 * out + 2.0 * away); fov = 104;
    roll = (0.06 * Math.sin(t * 1.3) + 0.05 * Math.sin(t * 0.7 + 2)) * (1 - 0.5 * away);
    lens.uniforms.uK.value = 0.5;
  }
  camera.position.copy(pos);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(aim);
  // the viewer's drag turns the head (page only); it eases back when let go
  if (look.yaw || look.pitch) { camera.rotateY(look.yaw); camera.rotateX(look.pitch); }
  if (headYaw || headPitch) { camera.rotateY(headYaw); camera.rotateX(headPitch); }
  if (roll) camera.rotateZ(roll);
  return x;
}

function frame(t) {
  const x = placeCamera(t);
  wave.update(t, x);
  // two spits: one blows the rider out (9.6-12 s), one comes out of the tube while we look back (15.5-18.5 s)
  spray.update(t, x, ss(9.6, 12.0, t) * (1 - ss(12.0, 12.4, t)));
  lens.uniforms.uT.value = t;
  lens.uniforms.uMist.value = 0.35 * ss(10.2, 10.8, t) * (1 - ss(11.2, 12.2, t));   // a veil, not a whiteout: the spit is the spray flying past
  lens.uniforms.uDrops.value = 0;   // drops on the glass read as bubbles floating on the sea
  spray.u.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  U.uT.value = t;
  U.uWake.value = 0;   // (foam on the water after the exit read as leopard spots with a hard edge; left off)
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
window.__renderAt = async (f, fps) => { const r = frame(f / fps); renderer.getContext().finish(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); return r; };
if (RENDER || q.has('t')) frame(+(q.get('t') || 0));
else { let T = 0, last = performance.now(); renderer.setAnimationLoop(() => { const now = performance.now(); T = (T + (now - last) / 1000) % LEN; last = now; frame(T); }); }
window.__ready = true;
