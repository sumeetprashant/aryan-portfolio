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

- `index.html`: biography, project summaries, case-study templates, contact links.
- `css/portfolio.css`: colors, typography, layout, responsive styles, motion preferences.
- `js/portfolio.js`: comparisons, case-study reader, navigation, motion control.
- `js/instruments.js`: the three original canvas illustrations.
- `assets/headshot.jpg`: the real portrait, styled in CSS without modifying the source.
- `assets/Aryan-Mehta-Resume.pdf`: the existing downloadable résumé.

The case studies are the four `<template id="story-…">` blocks in `index.html`.
The privacy rates in `portfolio.js` are historical study results, not live data.
The canvas visuals are explicitly labeled illustrations, not measurements or
real geographic prediction maps.

Motion follows the device’s reduced-motion setting, with a manual control in
the footer. Canvas rendering pauses off-screen, in a hidden browser tab, and
while a case study is open. The basic biography and project summaries remain
readable without JavaScript. Native dialogs support keyboard navigation,
Escape, focus trapping, and returning focus to the original button.

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
