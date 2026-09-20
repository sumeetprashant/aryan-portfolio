# Continue on another machine

1. `git clone https://github.com/sumeetprashant/aryan-portfolio.git && cd aryan-portfolio`
2. Copy Aryan's data folder (`Aryan-Mehta-Website-and-Data`, carried separately, never committed) into `_data/` here. `_data/` is git-ignored.
3. Open Claude Code in this folder (model claude-fable-5-1, effort high). Install the taste-skill plugin.
4. Paste the prompt below.
5. Preview: `python3 -m http.server 4173` from the repo root, open http://localhost:4173
6. Screenshots on Mac: in the HANDOFF.md command use
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `./shots/...` paths. Same flags.

Paths in HANDOFF.md are from the Windows PC; here the site is the repo root. three.js and fonts
are vendored in `vendor/` and `fonts/`; nothing to install. Exclude `_handoff/` when deploying.

## Prompt

```
You are continuing work on a portfolio website for Aryan Mehta. It is a gift from
his older brother Sumeet, who loves him and wants to give him something that
genuinely changes his chances. Treat it as emotional, careful work, not a task to
close. The standard is clean, minimal, premium, and unique in every aspect.

Start by reading, in this order:
1. _handoff/START-HERE.md and _handoff/HANDOFF.md (full state, history, what
   failed; Windows paths in it map to this repo root)
2. _data/profile-and-resume/profile.md (the facts; respect every honesty flag,
   invent no numbers). If _data is missing, ask Sumeet for it once.
3. The current build: index.html, css/, js/
Then load the taste-skill and run its pre-flight against what exists.

The problem to solve: the current version reads as a smartwatch landing page with
some text. A product has become the person's identity. Redesign it so the site is
about Aryan, and so it unfolds bit by bit the way a story does: chapters with
pacing, each with one idea, one visual, and at most one interaction. The fall
detection moment may survive as a beat inside one chapter. It must not be the hero.

Before writing code, give Sumeet one short proposal: the story spine (chapter
list, one line each) and the visual language, shown as a small visual, not prose.
Wait for his yes. After that, build without stopping to ask permission for steps
he already approved.

How to work with Sumeet. These matter because an earlier version hurt him badly:
- Look at every screen yourself before he sees it, using headless Chrome
  screenshots (command in HANDOFF.md, Mac paths in START-HERE.md).
- Show screenshots with a few plain words. Never ask for his verdict on work you
  have not seen rendered.
- If he is upset, keep working on the fix. Do not tell him to rest.
- Never spend money. No paid API or image generation calls. He generates images
  himself. If real photos are needed, list exactly which ones and ask him once.
- Keep everything self-hosted. The page claims zero third-party requests, which
  ties to Aryan's MIT research, so no CDNs, no analytics, no web font links.
- Never commit the _data folder.

Quality bar: zero AI tells. No blinking dots, numbered eyebrows, fake telemetry,
em-dashes, three equal cards, decorative separators, or motion without a reason.
Give short progress updates while you work. Make targeted edits rather than
rewriting whole files, and keep changes to what the story needs. Commit and push
at the end of each working session so the other machine stays in sync.
```
