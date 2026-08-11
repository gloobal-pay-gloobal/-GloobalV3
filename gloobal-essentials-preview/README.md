# Gloobal Access — local preview

1. npm install
2. npm run dev
3. Open the printed local URL, sign in through the demo onboarding flow,
   go to Account, and open "My Essentials" (5th tile, alongside Gloobal
   Bank / Gloobal Coin / PayLater / My Assets).

## Styling

The screens mix inline styles (the `T` / `C` theme tokens in
`frontend/constants/theme.js`) with Tailwind utility classes — Add Bank
and parts of Gloobal Coverage are laid out almost entirely with the
latter (`flex`, `px-5`, `rounded-3xl`, `text-slate-900`, arbitrary values
like `text-[32px]`). Tailwind is therefore not optional here: without it
those classes are inert and the affected screens collapse to plain block
flow, which reads as the screen being broken rather than unstyled.

The setup mirrors the sibling project's:

- `tailwind.config.js` — content globs cover `src/` (where
  `build_app.mjs` generates `GloobalApp.jsx`) and `../frontend/`, so a
  class in a module not yet listed in `build_app.mjs` still gets its
  utility emitted.
- `postcss.config.js` — `tailwindcss` + `autoprefixer`.
- `src/styles/global.css` — the `@tailwind` directives plus the app-wide
  reset (box-sizing, safe-area variables, no overscroll bounce, no tap
  highlight, no accidental text selection).
- `src/main.jsx` imports `./styles/global.css`.

`index.html` loads Space Grotesk, the display face referenced by
`T.fontDisplay`; it falls back to the system stack if that request fails.
