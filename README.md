# Barrel — inside a breaking wave, in three.js

The inside of a breaking wave, rendered live in the browser with three.js: a thick lip of water curling overhead,
the sun coming through it, spray, and the way out (the "eye") ahead until the wave spits you out onto the shoulder. No models, images, video or recorded sound: the wave, the light, the spray and the sound are all computed.

**Ride it: https://aiimpl.github.io/barrel/** (drag to look around)

## How it works
- **One surface** (`web/src/wave.js`): every frame, cross-sections are swept along the wave. A cross-section is the
  water's edge: the long back, the crest, the top of the lip, round its tip, back along its underside, down the face
  (the back wall of the tube), the trough, and the sea in front. The lip's centreline turns faster toward its tip
  (so it curls), and thins from about 1.3 m at the root to about 25 cm at the tip. The wave is 5.7 m high.
- **The peel**: how far the curl has gone (phi) depends on the position along the wave and the time. The break runs
  along the wave at 11 m/s: ahead it is a sloping shoulder, then the lip throws and lands (the tube), and behind it
  collapses into whitewater. The rider rides deep, is blown out through the eye by the spit, and outruns the peel
  onto the shoulder. The camera is one continuous move.
- **Light through the lip** (`web/src/water.js`): sunlight crosses the water's thickness along its path; red is
  absorbed several times faster than green and blue, so thin water glows aqua and thick water turns deep teal.
  Forward scattering makes it brightest when the sun is behind what you look at. The sun is on the beach side, which is
  what lights a tube from the inside.
- **Small water**: ripples from 18 cm to 4 m (gradient noise, no grid lines) carried along by the water with a
  two-phase flow map, faded out where they are finer than a pixel; in the lip the water's lumps stream toward the tip
  at 8 m/s. A sharp sun highlight with a faint wide sheen. Inside the closed tube the water reflects moving water,
  not the sky.
- **Foam and spray**: lace with holes that opens as it thins, shaded in its creases; spray thrown off the lip, a veil
  of offshore spray off the crest, mist in the tube, and the spit (`web/src/spray.js`). Each drop is born at a place
  on the wave (never relative to the camera) and is a function of its seed and the time, so any frame can be drawn
  on its own.
- **The camera**: an action-camera lens (fisheye: the edges squeezed, slight colour fringes).
- **Sound** (`tools/audio.py`): the roar, the hollow boom inside the tube, the spit's blast, all synthesised.

## Simplified
The wave is a shape that changes with time, not a fluid simulation. Sizes (a 5.7 m wave, a tube about 5 m high and
7 m wide) are typical of a heavy reef barrel, not a particular break.

Notes on how others build breaking waves, and what was tried here: `docs/RESEARCH.md`.

## Use
```sh
make serve     # http://127.0.0.1:8799/
make setup     # Python + Playwright for recording
make video     # build/frames (1920x1080) -> build/barrel.mp4
```

## License
MIT
