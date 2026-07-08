#!/usr/bin/env python3
"""List LINE sticker projects matching a query (debug helper)."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import sync_playwright

from line_playwright_common import get_storage, load_env
from provision_line_sticker import dismiss_wizards, ensure_creators_logged_in
from upload_line_zip import login_line

SCRIPT_DIR = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", type=Path, required=True)
    parser.add_argument("--query", default="")
    args = parser.parse_args()

    env = load_env(args.env.resolve())
    creator = env["LINE_CREATOR_ID"]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(storage_state=str(get_storage()), locale="zh-TW")
        page = ctx.new_page()
        list_url = f"https://creator.line.me/my/{creator}/sticker/?status=all&page=1"
        if args.query:
            from urllib.parse import quote

            list_url = (
                f"https://creator.line.me/my/{creator}/sticker/"
                f"?status=all&query={quote(args.query)}&page=1"
            )
        ensure_creators_logged_in(page, env, list_url)
        dismiss_wizards(page)
        page.wait_for_timeout(2_000)
        hrefs = page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href]'))
                .map((a) => a.getAttribute('href') || '')
                .filter((h) => /sticker/i.test(h))
                .slice(0, 40)"""
        )
        print(f"hrefs={hrefs[:10]}", flush=True)
        rows = page.evaluate(
            """() => {
                const out = [];
                for (const a of document.querySelectorAll('a[href*="/sticker/"]')) {
                    const href = a.getAttribute('href') || '';
                    const m = href.match(/\\/sticker\\/(\\d+)/);
                    if (!m) continue;
                    const row = a.closest('tr, li, article, div');
                    const text = (row ? row.innerText : a.innerText || '').trim().replace(/\\s+/g, ' ');
                    out.push({ id: m[1], href, text: text.slice(0, 160) });
                }
                const seen = new Set();
                return out.filter((r) => {
                    if (seen.has(r.id)) return false;
                    seen.add(r.id);
                    return true;
                });
            }"""
        )
        print(f"url={page.url}", flush=True)
        print(f"matches={len(rows)}", flush=True)
        for row in rows:
            print(f"{row['id']}\t{row['text']}", flush=True)
        browser.close()


if __name__ == "__main__":
    main()
