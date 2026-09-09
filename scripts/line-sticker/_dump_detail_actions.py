#!/usr/bin/env python3
"""Dump actionable controls on a LINE sticker detail page (debug)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("PYTHONUTF8", "1")

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "skills" / "line-sticker-upload" / "scripts"))

from playwright.sync_api import sync_playwright

from line_playwright_common import get_storage, load_env, sticker_detail_url
from submit_line_review import detect_review_status, ensure_logged_in


def main() -> int:
    env_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        ".line-upload/.env.batch/Huahua_Read_Reply_Chaos.env"
    )
    env = load_env(env_path)
    url = sticker_detail_url(env["LINE_CREATOR_ID"], env["LINE_STICKER_ID"])
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        storage = get_storage()
        ctx = browser.new_context(
            storage_state=str(storage) if storage.is_file() else None,
            locale="zh-TW",
        )
        page = ctx.new_page()
        ensure_logged_in(page, env, url)
        status = detect_review_status(page)
        texts = page.evaluate(
            """() => {
              const out = [];
              for (const el of document.querySelectorAll('a, button, span')) {
                const t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g,' ');
                if (!t || t.length > 48) continue;
                if (/取消|撤回|停止|編輯|Edit|審核|申請|Withdraw|Cancel|Stop|返回/.test(t)) {
                  out.push(t);
                }
              }
              return [...new Set(out)].slice(0, 50);
            }"""
        )
        print(json.dumps({"status": status, "url": url, "candidates": texts}, ensure_ascii=False, indent=2))
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
