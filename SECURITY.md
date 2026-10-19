# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub Security Advisories for this repository (Security → Advisories → New draft advisory), or contact the maintainer through their GitHub profile.

Do **not** open a public issue for unpatched vulnerabilities.

## API keys and secrets

This project is a **bring-your-own-key (BYOK)** browser app:

- Production / Docker / hosted builds **never** embed API keys in the client bundle or image.
- In Settings, users choose **Image provider** (`Google Gemini` or `OpenRouter (BYOK)`) and paste the matching key. Both keys are stored in `sessionStorage` for the current tab only.
- Optional local development may use `GEMINI_API_KEY` in `.env.local` (see `.env.example`) as a Gemini fallback during `npm run dev` only. There is **no** OpenRouter env-var injection.
- LINE Sticker and Comic tooling always use the Gemini key path, regardless of the selected sheet provider.

**Never paste API keys, Hugging Face tokens, LINE credentials, or session cookies into issues, pull requests, or screenshots.**

If you believe a key was exposed in a commit, comment, or deployed artifact:

1. Rotate / revoke the key at the provider immediately.
2. Notify the maintainers privately if the exposure is still reachable in git history or a public deployment.

## Scope notes

- Client-side XSS in a BYOK app can expose the user’s own key in that browser session — report XSS as a security issue.
- LINE sticker upload automation and `.secrets/` / `.line-upload/` paths are maintainer tooling and must never be committed.
