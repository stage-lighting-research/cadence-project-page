# Cadence — project page

Project site for **Cadence: a framework for music-responsive stage
lighting in generated concert video** (NeurIPS 2026 Creative AI Track
submission).

Single-page, no build step, no external dependencies. Serves directly
from GitHub Pages.

## Directory layout

```
cadence-page/
├── index.html                         ← the whole page
├── static/
│   ├── style.css                      ← responsive stylesheet
│   ├── main.js                        ← video-sync + copy-BibTeX
│   ├── teaser.png                     ← architecture diagram
│   └── favicon.png                    ← 64×64 site icon
├── assets/
│   └── examples/
│       ├── ex1/
│       │   ├── reference.jpg          ← 512×512 recommended
│       │   ├── prompt.txt             ← the lighting-description caption
│       │   ├── audio.mp3              ← input music (≤ 500 KB)
│       │   ├── wan.mp4                ← Wan2.2-S2V baseline output
│       │   ├── wan_lora.mp4           ← Wan2.2-S2V + LoRA output
│       │   └── cadence.mp4            ← Cadence-S2V output (ours)
│       ├── ex2/…
│       ├── ex3/…
│       └── ex4/…
└── README.md
```

## Deploy to GitHub Pages

```bash
# 1. Initialise repo
mkdir cadence && cd cadence
# copy this directory's contents in
git init && git add . && git commit -m "cadence project page"

# 2. Push
git remote add origin https://github.com/<username>/cadence.git
git branch -M main
git push -u origin main

# 3. Enable Pages
#    GitHub → your repo → Settings → Pages
#    Source: "Deploy from a branch"
#    Branch: main → / (root) → Save
```

Live at `https://<username>.github.io/cadence/` after ~30 s.

## Prepare video assets

Web-compressed videos load fast on mobile and don't blow your
GitHub Pages bandwidth. For every generated MP4:

```bash
ffmpeg -i INPUT.mp4 \
       -vf "scale=512:-2" \
       -c:v libx264 -crf 26 -preset veryfast -pix_fmt yuv420p \
       -c:a aac -b:a 96k -ac 1 \
       -movflags +faststart \
       OUTPUT.mp4
```

Target 1.5–3 MB per clip. `+faststart` moves the MP4 metadata to the
front of the file so the video begins playing before it's fully
downloaded.

For the audio player:

```bash
ffmpeg -i audio.wav -c:a libmp3lame -b:a 128k -ac 1 audio.mp3
```

## Anonymity policy (important)

The Cadence codebase is **never** linked from this page — no GitHub link,
no download link, no reference to the training scripts or repo layout,
even after de-anonymisation. If you need to add a Paper link later:

1. Wait until the paper's arXiv or OpenReview URL is public.
2. Edit `index.html` → find the `<a href="#" class="btn" data-role="paper">`
   → replace `#` with the URL.
3. Do **not** add a code button back.

The `<!-- ANONYMITY: -->` comment in the hero marks the exact spot.

## Customise

- **Paste your abstract:** replace the paragraph marked
  `▼ PASTE YOUR ABSTRACT HERE ▼` inside `#abstract` in `index.html`.
- **Per-example prompt:** drop a `prompt.txt` into the example folder
  (`assets/examples/exN/prompt.txt`). The page loads it automatically.
- **Change the accent colour:** edit `--accent` in `static/style.css`
  (currently magenta `#ff2a92`).
- **Add more examples:** copy any `<article class="example" data-example="N">`
  block in `index.html`, bump `N`, and change `ex1` → `exN` in the paths.
- **Paper link:** edit the single `<a class="btn" data-role="paper">` in
  the hero. Only add when the paper URL is public.
- **BibTeX:** edit the `<pre>` block inside `#cite`. Keep `author = {Anonymous}`
  until the paper is de-anonymised.

## Serving locally to test

`prompt.txt` files are fetched via `fetch()`. Opening `index.html` with
`file://` blocks `fetch()` on most browsers, so use a tiny local server
while iterating:

```bash
# In the cadence-page/ directory
python3 -m http.server 8000
# then visit http://localhost:8000/
```

GitHub Pages itself serves via HTTPS so `fetch()` works out of the box.

## Browser support

Tested against:

| Browser         | Version | Status |
| --------------- | ------- | ------ |
| Chrome / Edge   | 90+     | ✓      |
| Firefox         | 88+     | ✓      |
| Safari (macOS)  | 14+     | ✓      |
| Safari (iOS)    | 14+     | ✓      |
| Samsung Internet| 14+     | ✓      |

Progressive-enhancement fallbacks handle older engines:

- **Gradient text** in `<h1>` falls back to a solid accent colour if
  the browser doesn't support `-webkit-background-clip: text`.
- **`aspect-ratio`** falls back to a fixed video height on very old
  Safari.
- **IntersectionObserver** falls back to autoplaying all videos on
  load if the API is unavailable.
- **`navigator.clipboard`** falls back to a hidden `<textarea>` +
  `document.execCommand('copy')` for the BibTeX button.
- **`prefers-reduced-motion`** disables the background glow animation
  and smooth-scroll.

## Responsive breakpoints

| Width          | Layout                                                      |
| -------------- | ----------------------------------------------------------- |
| ≥ 900 px       | 3-column video grid (Wan / Wan+LoRA / Cadence)              |
| 600 – 900 px   | 2-column grid with Cadence spanning the full row below      |
| < 600 px       | 1-column stack, everything full-width                       |
| < 380 px       | Tighter reference-image thumbnails                          |

## Accessibility

- Semantic HTML5 (`<article>`, `<figure>`, `<figcaption>`).
- WCAG AA contrast on all text over the dark background.
- Focus-visible outlines on all interactive controls.
- `prefers-reduced-motion` respected on animations + smooth-scroll.
- `prefers-contrast: more` tightens border colours.
- `alt` attributes on every image; `<video>` elements have text
  fallback content.
- `<audio controls>` uses the browser's native, screen-reader-
  compatible player.

## License

Site source is your own. Videos and audio remain under whatever
licence the underlying LuSyClip dataset uses — clarify per-example
if you plan to share the page publicly.
