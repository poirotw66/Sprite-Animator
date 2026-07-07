#!/usr/bin/env python3
"""Debug LINE sticker create save button state."""

from __future__ import annotations

import os
import re

os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import sync_playwright

from line_playwright_common import PROJECT_ROOT, STORAGE, dismiss_overlays, load_env


def main() -> None:
    env = load_env(PROJECT_ROOT / ".env")
    c = env["LINE_CREATOR_ID"]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            storage_state=str(STORAGE),
            locale="zh-TW",
            viewport={"width": 1400, "height": 900},
        )
        pg = ctx.new_page()
        pg.goto(
            f"https://creator.line.me/my/{c}/sticker/create",
            wait_until="networkidle",
            timeout=120_000,
        )
        dismiss_overlays(pg)
        pg.locator('input[name="sticker_type"][value="static"]').click(force=True)
        pg.fill('input[name="meta[en][title]"]', env.get("STICKER_TITLE_EN", ""))
        pg.fill('textarea[name="meta[en][description]"]', env.get("STICKER_DESC_EN", ""))
        pg.locator("select").first.select_option(label="Chinese (Traditional)")
        pg.wait_for_timeout(400)
        main = pg.locator("main.content")
        main.get_by_role("button", name=re.compile(r"^\u65b0\u589e$")).first.click()
        pg.wait_for_timeout(1_500)
        for tk in ("meta[zh-Hant][title]", "meta[zh_TW][title]"):
            loc = pg.locator(f'input[name="{tk}"]')
            if loc.count():
                loc.first.fill(env.get("STICKER_TITLE_ZH", ""))
                print("title field", tk)
                break
        for dk in ("meta[zh-Hant][description]", "meta[zh_TW][description]"):
            loc = pg.locator(f'textarea[name="{dk}"]')
            if loc.count():
                loc.first.fill(env.get("STICKER_DESC_ZH", ""))
                print("desc field", dk)
                break
        pg.fill('input[name="copyright"]', env.get("COPYRIGHT", ""))
        pg.locator('input[name="is_ai_generated"][value="true"]').click(force=True)
        pg.fill('input[name="design_url"]', env.get("GDRIVE_SHARE_URL", ""))
        pg.locator('input[name="area_group"][value="all"]').click(force=True)
        pg.locator('input[name="is_auto_release"][value="true"]').click(force=True)
        pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        pg.wait_for_timeout(600)
        info = pg.evaluate(
            """() => {
                const b = document.querySelector('[data-test="btn-save"]');
                if (!b) return null;
                const r = b.getBoundingClientRect();
                return {
                    disabled: b.disabled,
                    ng: b.getAttribute('ng-disabled'),
                    x: r.x,
                    y: r.y,
                    h: r.height,
                    w: r.width,
                    vw: innerWidth,
                    vh: innerHeight,
                };
            }"""
        )
        print(info)
        browser.close()


if __name__ == "__main__":
    main()
