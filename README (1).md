# ⌨️ TypeRush

A fast, good-looking typing speed game that runs entirely in the browser. Words fall from the sky, you type them before they land, build combos, level up, and share your result card.

> Built with plain HTML, CSS and JavaScript. No frameworks, no build step, no dependencies.

**🎮 Live demo:** `https://YOUR-USERNAME.github.io/YOUR-REPO/` *(replace after deploying)*

<!-- Add a screenshot or GIF here: ![TypeRush gameplay](assets/demo.gif) -->

## Features

- **Two game modes**
  - 🛡️ **Survival**: 3 lives, and words speed up every level
  - ⏱️ **Time Attack**: 60 seconds, pure speed
- **Live HUD** with score, WPM, accuracy, combo multiplier, level and lives/timer
- **Combo system**: every 5 words in a row raises your score multiplier (up to ×5)
- **Ranks** from 🐣 Script Kiddie to 🧙 Keyboard Wizard
- **Shareable result card**: a 1200×630 PNG drawn on canvas. Download it, copy a share message, or use the native share sheet on mobile
- **Personal bests** saved per mode in `localStorage`
- Tiny WebAudio sound effects (mute toggle included, no audio files)
- Pause with `Esc`, and the game auto-pauses when you switch tabs
- Responsive, with a dark navy theme and reduced-motion support

## How to play

1. Enter your name and pick a mode.
2. Type the falling words. No Enter key needed, a word clears the moment you finish it.
3. A wrong key resets your combo, and a word that lands costs you a life (Survival) or your combo (Time Attack).
4. Finish the run, then download or share your result card.

### Scoring

| Item | Value |
| --- | --- |
| Word score | `letters × 10 × multiplier` |
| Multiplier | `1 + 0.5` for every 5-word combo, capped at ×5 |
| Level up | every 8 words |
| WPM | `(characters typed in finished words ÷ 5) ÷ minutes played` |

### Ranks

| WPM | Rank |
| --- | --- |
| 0+ | 🐣 Script Kiddie |
| 20+ | ⌨️ Junior Dev |
| 40+ | 🚀 Mid-Level |
| 60+ | ⚡ Senior Dev |
| 80+ | 🔥 10x Dev |
| 100+ | 🧙 Keyboard Wizard |

## Run locally

No install needed. Just open `index.html` in your browser.

Or serve it with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy free on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
4. Save. Your game will be live at `https://<username>.github.io/<repo>/` in a minute or two.

## Project structure

```
.
├── index.html   # markup for the menu, game and result screens
├── style.css    # theme and layout
├── script.js    # game engine, scoring, sound and share card
└── README.md
```

## Customize it

- **Word list**: edit the `WORDS` array at the top of `script.js` (it ships with developer-themed words).
- **Difficulty**: tweak the fall speed in `spawnWord` and the spawn rate in `spawnInterval`.
- **Modes**: add an entry to `MODES` in `script.js` and a matching card in `index.html`.
- **Theme**: change the CSS variables at the top of `style.css`.

## Ideas to extend

- Online leaderboard (Supabase or Firebase)
- Custom word packs (code snippets, quotes, other languages)
- Boss words and power-ups
- Daily challenge with a fixed seed

## License

Add a license of your choice (MIT is a good default) via GitHub: **Add file → Create new file → `LICENSE`**.
