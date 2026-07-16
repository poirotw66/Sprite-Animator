## Troubleshooting

If something goes wrong, try the following steps:

1. Hard-refresh the browser (clear cache) and reload the app.
2. Verify your API key in Settings, or set `GEMINI_API_KEY` in `.env.local`.
3. Open the DevTools console to check error messages.
4. For image generation issues, try a smaller image and reduce steps first.
5. If the Daily Registry does not auto-load, clone the vault as `../line-sticker-vault` or set `STICKER_VAULT_ROOT` (see `vite.config.ts`).

When filing an issue, please include:
- What you tried to do
- Exact error message and a screenshot if possible
- Browser and OS version

