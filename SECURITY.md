# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub Security Advisories for this repository (Security → Advisories → New draft advisory), or contact the maintainer through their GitHub profile.

Do **not** open a public issue for unpatched vulnerabilities.

## API keys and secrets

This project is a **bring-your-own-key (BYOK)** browser app:

- Production / hosted builds **never** embed API keys in the client bundle.
- Users paste their own Gemini and/or OpenRouter key in Settings; keys are stored in `sessionStorage` for the current tab only.
- Optional local development may use `GEMINI_API_KEY` in `.env.local` (see `.env.example`); that value is only injected by `vite` during `npm run dev`, not into production builds.

**Never paste API keys, Hugging Face tokens, LINE credentials, or session cookies into issues, pull requests, or screenshots.**

If you believe a key was exposed in a commit, comment, or deployed artifact:

1. Rotate / revoke the key at the provider immediately.
2. Notify the maintainers privately if the exposure is still reachable in git history or a public deployment.

## Scope notes

- Client-side XSS in a BYOK app can expose the user’s own key in that browser session — report XSS as a security issue.
- LINE sticker upload automation and `.secrets/` / `.line-upload/` paths are maintainer tooling and must never be committed.
