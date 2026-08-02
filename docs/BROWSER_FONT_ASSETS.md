# Browser font assets

`fonts/*.ttf` is a local font vault and remains ignored by Git. The Node/headless
LINE-sticker pipeline reads those original TTF files directly. Browser previews
instead use full-glyph WOFF2 copies, generated locally so the browser build does
not deploy the larger TTF masters.

Run these commands after adding or replacing a local TTF:

```sh
npm run fonts:build
npm run fonts:check
```

`npm run build` runs both automatically when local TTF files are present. The
check compares the original and WOFF2 Unicode cmap plus glyph count; it is not a
character subset, so Traditional Chinese coverage is retained. The generated
`.woff2` files stay in the ignored `fonts/` vault and must not be force-added
without separately reviewing the font's distribution terms.

When no local font vault is available (for example, a clean CI checkout), the
build succeeds and the browser deliberately uses the existing system-font stacks
instead of issuing a failing TTF request. The headless TTF behavior is unchanged.
