#!/usr/bin/env python3
"""Dump radio/label structure on the editable sticker form."""

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
from provision_line_sticker import (
    dismiss_wizards,
    open_edit_button_if_present,
    open_sticker_edit_form,
    withdraw_to_edit_if_needed,
)
from submit_line_review import ensure_logged_in


def main() -> int:
    env = load_env(Path(sys.argv[1]))
    url = sticker_detail_url(env["LINE_CREATOR_ID"], env["LINE_STICKER_ID"])
    out = REPO / "output" / "_upload0909-logs"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        storage = get_storage()
        ctx = browser.new_context(
            storage_state=str(storage) if storage.is_file() else None,
            locale="zh-TW",
        )
        page = ctx.new_page()
        ensure_logged_in(page, env, url)
        dismiss_wizards(page)
        withdraw_to_edit_if_needed(page)
        dismiss_wizards(page)
        open_edit_button_if_present(page)
        if page.locator('input[name="meta[en][title]"]').count() == 0:
            open_sticker_edit_form(page, env, env["LINE_CREATOR_ID"], env["LINE_STICKER_ID"])
        page.locator('input[name="meta[en][title]"]').wait_for(state="visible", timeout=90_000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(800)
        page.screenshot(path=str(out / "edit_form.png"), full_page=True)
        data = page.evaluate(
            """() => {
              const labels = [...document.querySelectorAll('label')].map(l => ({
                text: (l.innerText||'').trim().replace(/\\s+/g,' ').slice(0,80),
                for: l.getAttribute('for'),
                hasRadio: !!l.querySelector('input[type=radio]')
              })).filter(x => x.text);
              const radios = [...document.querySelectorAll('input[type=radio]')].map(r => ({
                name: r.name, value: r.value, checked: r.checked,
                id: r.id,
                label: (document.querySelector('label[for=\"'+r.id+'\"]')||{}).innerText || ''
              }));
              const joinish = labels.filter(l => /參加|不參加|Participate|超值|拼貼|試用|特輯|企劃/.test(l.text));
              return { labelCount: labels.length, radioCount: radios.length, joinish, radios: radios.slice(0,80) };
            }"""
        )
        (out / "edit_form_radios.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps({"has_form": True, "joinish": data.get("joinish"), "radioCount": data.get("radioCount")}, ensure_ascii=False, indent=2))
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
