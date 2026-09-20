// Makes the felt head-turn clip scrubbable. Run from the workspace root once the clip exists:
//   node site/scripts/prep_felt_clip.mjs path/to/clip-from-codex.mp4
// Re-encodes it all-intra (every frame a keyframe, so any currentTime lands at once), without
// audio, to site/assets/felt-look.mp4, and flips site/assets/felt-clip.js to ready.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source || !existsSync(source)) { console.error('Give the path of the source clip.'); process.exit(1); }
const out = 'site/assets/felt-look.mp4';
execFileSync('ffmpeg', ['-y', '-i', source, '-an', '-vf', 'scale=-2:1080,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-g', '1', '-keyint_min', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
writeFileSync('site/assets/felt-clip.js', "// Written by scripts/prep_felt_clip.mjs. While ready is false the summary shows felt-still.webp.\nexport default { ready: true, src: 'assets/felt-look.mp4' };\n");
console.log(`${out} written. Restart the preview server if it was started before .mp4 was in its mime table.`);
