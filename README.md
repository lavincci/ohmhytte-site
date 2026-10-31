# ohmhytte.com

The Ohmhytte home page: one cinematic hero with the four platform links, then the newest films and shorts.

- `src/`: the page, its styles and assets. `src/parts/` holds SVGs that the build inlines.
- `scripts/build.mjs`: builds `dist/` from `src/` and the channel's YouTube feed (Node 20+, no packages). If the feed
  fails, it uses the last good list in `data/latest.json`.
- `.github/workflows/publish.yml`: publishes to GitHub Pages on every push, and checks for new uploads hourly.

Preview locally with `node scripts/build.mjs`, then serve `dist/`.
