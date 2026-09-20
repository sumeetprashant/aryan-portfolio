# Aryan Mehta portfolio - handoff (2026-09-19)

## What this is
Sumeet's gift to his younger brother Aryan. Emotional work, not a ticket. The bar: clean, minimal, premium, unique in every aspect, and far above srikanthnani.com (template look Sumeet dislikes).

## Where things are
- `site/` - current build. `index.html`, `css/site.css`, `js/main.js`, `js/scene.js` (three.js watch), `vendor/` (three 0.185 + addons), `fonts/` (Bricolage Grotesque, Source Sans 3), `assets/` (headshot, resume).
- `Aryan-Mehta-Website-and-Data/profile-and-resume/profile.md` - source of truth for facts. Respect its honesty flags (BP model is proof of concept, Lockheed is a capstone not employment, no invented numbers).
- `shots/` - my screenshots. Preview: launch config `aryan-site`, http://localhost:4173.
- Everything is self-hosted on purpose: the page claims 0 third-party requests (ties to his MIT paper). three.js and fonts were copied from `G:\01.gpt-space\adunova_sources\*\node_modules`. No downloads were made.

## History, honestly
1. v1: flat off-white page in Arial. Sumeet called it the ugliest thing he had seen and was deeply hurt. Causes: over-corrected away from "vibe-coded" polish, banned fonts/3D to protect a gimmick, shipped without ever seeing it rendered, then asked him for a verdict.
2. v2 (current): dark, three.js procedural smartwatch that tumbles when you flick the cursor, "Fall detected" state, case panels (live privacy meter, draggable pendulum), timeline, contact.
3. De-slop pass with taste-skill: removed blinking dots, numbered eyebrows, fake telemetry log, middle-dot separators, em-dashes, bar background tracks, grain animation.

## Sumeet's verdict on v2 (the brief for v3)
- "It looks like a smartwatch landing page with some text." The Kiwi watch has become Aryan's whole identity. Wrong: the site must be about the person. The watch is one chapter.
- The portfolio should unfold bit by bit, like a story. Chapters, pacing, reveals. Not hero + sections.
- Blinking dots and similar are telltale slop. Zero tolerance for AI tells.
- Clean, minimal, premium.

## Open problems for v3
- Narrative structure. Possible spine: engineer kid -> research at MIT/Harvard -> founding PM -> co-CEO at 22 -> what he wants next. Each chapter gets one idea, one visual, one interaction at most.
- Hero must be about Aryan, not a product. The fall moment can survive as a chapter beat.
- Real imagery is missing. Only one headshot exists. Ask Sumeet/Aryan for photos (product, hospital trial, capstone rig, team). Sumeet regenerates images himself in Codex; never make paid image calls.
- Still vanilla `scroll` listener and cards-heavy work section; trio of equal cards is an AI tell. Rework.
- No light mode. Motion was only verified as still frames (headless Chrome freezes rAF).
- Copy: Aryan accepted a PM job at Stellus Rx (started 2026-08-31). "What I'm doing now" needs his input. Decide with him what is public (visa, comp never).
- Not deployed, no domain, no OG image/favicon.

## How to verify (the in-app preview pane does not paint)
```
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader --ignore-gpu-blocklist --hide-scrollbars --user-data-dir="G:/01.gpt-space/aryan_folio/shots/.profile" --window-size=1440,900 --virtual-time-budget=3500 --screenshot="G:/01.gpt-space/aryan_folio/shots/x.png" "http://localhost:4173/?shot"
```
`?shot` freezes reveals; `?shot&pose=down` shows the landed watch; use a tall window (1440x7600) + PIL crop for sections; min headless width is 500.

## Working with Sumeet
Look at every screen yourself before showing him. Show screenshots, few words. No verdict requests on unseen work. When he is upset, do the work; do not tell him to rest. Never spend money.
