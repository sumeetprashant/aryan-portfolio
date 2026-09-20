# Aryan Mehta’s portfolio

A personal portfolio built with plain HTML, CSS and JavaScript. All images,
fonts and scripts are served locally. No framework, package install, analytics,
external APIs, or paid services are required.

## Preview

From this folder, run:

```sh
node scripts/preview.mjs
```

Open **http://127.0.0.1:4173/**. The preview server binds only to this computer.
To choose another port, set the `PORT` environment variable first.

## What to edit

The page is one idea: the site stays composed while Aryan is redrawn in a new
material per chapter (pixels, a pixel melt, characters, cubes, blocks, the felt
character, the photograph with a few pixels left in it). Every change of material passes
through characters. A light / dark switch sits in the header.

- `index.html`: all copy, one `<section class="chapter">` per version. `data-state`
  picks the portrait material, `data-side` the copy column, `data-note` the
  handwritten line above his head. Case studies are the four `<template id="story-...">` blocks.
- `js/stage.js`: the fixed WebGL2 portrait. Every material is a shader state drawn
  from the same registered photo, so states dissolve into each other in place.
- `js/journey.js`: scroll position to portrait state, the per-chapter assets
  (ASCII chart, week signals, block grids), the case-study reader, motion control.
- `css/journey.css`: layout, type, per-chapter asset styles.
- `scripts/prep_stage.py`: registers the source portraits to one eye position and
  cuts their mattes into `assets/stage/*.jpg` (colour left half, matte right half).
  Needs the asset pack unzipped to `../pack/`. Re-run only if a portrait changes.
- `index-codex.html`, `css/portfolio.css`, `js/portfolio.js`, `js/instruments.js`:
  the previous editorial build, kept for reference. Not loaded or packaged.

## Publish safely

```sh
node scripts/package.mjs
```

This prepares `../output/publish/` using an explicit allowlist. Upload **the
contents of that folder** to a static host. Do not upload the whole workspace:
it also contains private source material, handoff notes, and rejected studies.
The prepared `../output/aryan-portfolio.zip` contains the same publishing files.

Once a public domain is selected, make `og:image` in the published `index.html`
an absolute URL ending in `/assets/social-preview.png`. Add the public site URL
as the canonical URL and `og:url`. The 1200 × 630 sharing image is included.
All normal asset and navigation paths are relative, so subdirectory hosting
works too. There is no build command or backend to configure.

## Content notes

Career claims were checked against the supplied profile. In particular:

- Fall-detection metrics are from ten working-age participants, not validated
  clinical performance in elderly users.
- The 450× improvement concerns wrist-posture false alarms against one baseline.
- Network destinations do not establish whether conversation contents were shared.
- Prognosis’s India work and Harvard’s Colombia work are distinct projects.
- Lockheed Martin was a sponsored academic capstone, not employment.
- The leadership chapter describes the documented July 2026 transition. The
  newer Stellus Rx role has not been added without confirmation of public wording.
- No visa, compensation, personal phone number, or private operational records
  are included in the new page.

The old `css/site.css`, `js/main.js`, `js/scene.js`, `vendor/`, and `v3/` studies
remain in the repository for reference, but are not loaded or packaged by this build.
The previous homepage was also saved outside the site in `../output/previous/`.
