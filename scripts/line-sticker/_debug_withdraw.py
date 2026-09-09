#!/usr/bin/env python3
"""Debug withdraw-to-edit for one sticker env."""

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
from provision_line_sticker import withdraw_to_edit_if_needed
from submit_line_review import detect_review_status, ensure_logged_in


def main() -> int:
    env_path = Path(sys.argv[1])
    env = load_env(env_path)
    url = sticker_detail_url(env["LINE_CREATOR_ID"], env["LINE_STICKER_ID"])
    out = REPO / "output" / "_upload0909-logs"
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        storage = get_storage()
        ctx = browser.new_context(
            storage_state=str(storage) if storage.is_file() else None,
            locale="zh-TW",
        )
        page = ctx.new_page()
        ensure_logged_in(page, env, url)
        from provision_line_sticker import dismiss_campaign_float, dismiss_wizards
        dismiss_wizards(page)
        dismiss_campaign_float(page)
        status = detect_review_status(page)
        page.screenshot(path=str(out / "withdraw_before.png"), full_page=True)
        texts = page.evaluate(
            """() => [...new Set(
              [...document.querySelectorAll('a,button,span')]
                .map(el => (el.innerText||'').trim().replace(/\\s+/g,' '))
                .filter(t => t && t.length <= 30)
            )].slice(0, 80)"""
        )
        withdrew = withdraw_to_edit_if_needed(page)
        page.wait_for_timeout(2000)
        # try clicking any confirm
        for t in ("確定", "OK", "是", "Yes"):
            btn = page.get_by_role("button", name=t)
            if btn.count() and btn.first.is_visible():
                btn.first.click()
                page.wait_for_timeout(1000)
        has_form = page.locator('input[name="meta[en][title]"]').count() > 0
        page.screenshot(path=str(out / "withdraw_after.png"), full_page=True)
        status2 = detect_review_status(page)
        payload = {
            "url": page.url,
            "status_before": status,
            "status_after": status2,
            "withdrew": withdrew,
            "has_form": has_form,
            "texts": texts,
        }
        (out / "withdraw_debug.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
