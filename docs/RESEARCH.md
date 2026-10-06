# How breaking waves are made (research notes)

What the people who have built a barrel before actually did, and what this project takes from it.
The papers and the reference footage are not in this repository (they belong to others); the links are below.

## Surf's Up (Sony Pictures Imageworks, SIGGRAPH 2007)

- No fluid simulation for the hero wave: it is not predictable and cannot be directed. The wave is treated as a character.
- A handful of 2-D cross-section profiles, modelled by hand, are interpolated with splines into a 4-D surface:
  the third dimension runs along the wave, the fourth is time decoupled from the clock (how far the break has gone).
- Spline interpolation was chosen over rotation-based schemes because it passes exactly through the sampled profiles
  with smooth tangents. Values stored on the profiles (energy, speed, crash) are interpolated per vertex with it.
- Controls: lip up/down and forward/back, trough depth, shoulder size, tube depth and length, front/back length.
- The water's texture lives in an interpolated reference space that flows over the surface; whitewater is launched
  from a "crash curve" along the lip; surface turbulence is a displacement that the preview and the render share.

## True Surf (True Axis)

- A wave that peels from spilling to plunging is a series of 2-D animations of vertical slices, blended along the wave.
- The slice animations were drawn from a custom 2-D water simulation used as reference.

## Breakline (three.js surfing game, vice7770/surfing-game)

- The lip is never thicker than the water it is made of; it is spline-smoothed with rounded edges.
- Sun and sky light pass through the lip by Beer–Lambert over its path; it whitens to foam with age.

## The real wave (Teahupoo, side-on footage)

- The lip is thrown short and thick, and is one piece with the wall under it: no corner anywhere on the face.
- The tube is an oval wider than it is tall.
- Only the lip's edge and its spray are white; the wall is clear, deep blue-green water.

## What this project does with it

- Cross-sections are keyframes taken from the real wave (crest, a thick lip as a centreline plus thickness, the wall
  under it, the trough), interpolated through with Catmull-Rom splines in phi (how far the break has gone), not
  invented by formula. Parts meet with matching tangents.
- Lesson: when it does not look right, do not stack corrections on a wrong base shape (bends, steps, flips each broke
  something else). Fix the base from reference.

## Sources

- Making Waves for Surf's Up — https://www.imageworks.com/sites/default/files/2023-10/making-waves-for-surfs-up.pdf
- Surf's Up: A Practical Guide to Making Waves — https://history.siggraph.org/animation-video-pod/surfs-up-a-practical-guide-to-making-waves-by-sony-pictures-imageworks/
- True Surf — https://www.meta.com/blog/true-surf-launch/
- Breakline barrel look, PR #25 — https://github.com/vice7770/surfing-game/pull/25
- Breakline — https://github.com/vice7770/surfing-game
- Realistic breaking wave (Unity Discussions) — https://discussions.unity.com/t/realistic-breaking-wave/748291
- A Procedural Model for Interactive Animation of Breaking Ocean Waves — https://www.researchgate.net/publication/221546554_A_Procedural_Model_for_Interactive_Animation_of_Breaking_Ocean_Waves
- Procedural Modelling and Animation of Breaking Waves (MSc thesis) — https://nccastaff.bournemouth.ac.uk/jmacey/MastersProject/MSc09/Fan/msc_thesis_finellafan.pdf
- Reference footage used for comparison (not redistributed): youtube.com/watch?v=GZlFBwxFmmg, youtube.com/watch?v=jGxE1soC1hI
