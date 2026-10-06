# Barrel — inside a breaking wave, in three.js

The inside of a breaking wave, rendered live in the browser with three.js: a lip of water a few centimetres thick
curling overhead, the sun coming through it, spray, and the way out (the "eye") getting smaller until the wave spits
you out. No models, images, video or recorded sound: the wave, the light, the spray and the sound are all computed.

**Ride it: https://aiimpl.github.io/barrel/** (drag to look around)

## How it works
- **One surface** (`web/src/wave.js`): every frame, cross-sections are swept along the wave. A cross-section is the
  water's edge: the long back, the crest, the top of the lip, round its tip, back along its underside, down the face
  (the back wall of the tube), the trough, and the sea in front. The lip's centreline turns faster toward its tip
  (so it curls), and thins from 34 cm at the root to about 3 cm at the tip.
- **The peel**: how far the curl has gone (phi) depends on the position along the wave and the time. The break runs
  along the wave at 7 m/s: ahead it is a steep wall, then the lip throws and lands (the tube), and behind it collapses
  into whitewater. The rider stays at a fixed curl, a little deeper as the ride goes on, so the eye closes in.
- **Light through the lip** (`web/src/water.js`): sunlight crosses the water's thickness along its path; red is
  absorbed several times faster than green and blue, so thin water glows aqua and thick water turns deep teal.
  Forward scattering makes it brightest when the sun is behind what you look at. The sun is on the beach side, which is
  what lights a tube from the inside.
- **Streaks and chop**: ripples stretched along the flow (the water runs up the face and over the lip), warped so they
  never line up into rings, plus a fine chop in every direction.
- **Foam**: lace with holes that opens as it thins, shaded in its creases; spray thrown off the lip, a veil of
  offshore spray off the crest, mist in the tube, and the spit (`web/src/spray.js`). Each drop is a function of its
  seed and the time, so any frame can be drawn on its own.
- **The camera**: an action-camera lens (barrel distortion, slight colour fringes, drops on the glass after the spit).
- **Sound** (`tools/audio.py`): the roar, the hollow boom inside the tube, the spit's blast, all synthesised.

## Simplified
The wave is a shape that changes with time, not a fluid simulation. Sizes (3 m wave, a tube about 2.6 m high and 4 m
wide) are typical of a surfable barrel, not a particular break.

## Use
```sh
make serve     # http://127.0.0.1:8799/
make setup     # Python + Playwright for recording
make video     # build/frames (1920x1080) -> build/barrel.mp4
```

## License
MIT
