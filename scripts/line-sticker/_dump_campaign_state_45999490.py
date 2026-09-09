#!/usr/bin/env python3
"""Dump campaign radio checked state for sticker 45999490."""

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
    env = load_env(REPO / ".line-upload" / ".env.batch" / "Sticker_45999490.env")
    url = sticker_detail_url(env["LINE_CREATOR_ID"], env["LINE_STICKER_ID"])
    out = REPO / "output" / "_upload0909-logs" / "campaign_state_45999490.json"
    out.parent.mkdir(parents=True, exist_ok=True)

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

        data = page.evaluate(
            """() => {
              const joinTexts = new Set(['參加', '参加', 'Participate']);
              const declineTexts = new Set(['不參加', '不参加', 'Do not participate']);
              const labelText = (el) => (el.innerText || el.textContent || '').trim();
              const radioFor = (label) =>
                label.querySelector('input[type="radio"]')
                || document.getElementById(label.getAttribute('for') || '');

              const rows = [];
              for (const label of document.querySelectorAll('label')) {
                const t = labelText(label);
                if (!joinTexts.has(t) && !declineTexts.has(t)) continue;
                const input = radioFor(label);
                if (!input || input.type !== 'radio') continue;
                let node = label.parentElement;
                let ctx = '';
                for (let i = 0; i < 10 && node; i++) {
                  const raw = (node.innerText || '').replace(/\\s+/g, ' ').trim();
                  if (raw.length > 4 && raw.length < 240) { ctx = raw; break; }
                  node = node.parentElement;
                }
                const rect = label.getBoundingClientRect();
                rows.push({
                  text: t,
                  checked: !!input.checked,
                  name: input.name || '',
                  value: input.value || '',
                  id: input.id || '',
                  disabled: !!input.disabled,
                  visible: rect.width > 0 && rect.height > 0,
                  ctx: ctx.slice(0, 160),
                });
              }

              const body = document.body.innerText || '';
              const trialIdx = body.indexOf('免費試用');
              const snippet = trialIdx >= 0
                ? body.slice(Math.max(0, trialIdx - 60), trialIdx + 100).replace(/\\s+/g, ' ')
                : null;

              // Reconstruct pairs like configure_campaigns
              const pairs = [];
              const usedJoin = new Set();
              for (const label of document.querySelectorAll('label')) {
                if (!joinTexts.has(labelText(label))) continue;
                const joinInput = radioFor(label);
                if (!joinInput || usedJoin.has(joinInput)) continue;
                let container = label.parentElement;
                let declineLabel = null;
                for (let depth = 0; depth < 10 && container; depth++) {
                  const joinLabs = [];
                  const declineLabs = [];
                  for (const lab of container.querySelectorAll('label')) {
                    const lt = labelText(lab);
                    if (joinTexts.has(lt)) joinLabs.push(lab);
                    else if (declineTexts.has(lt)) declineLabs.push(lab);
                  }
                  if (joinLabs.length === 1 && declineLabs.length === 1 && joinLabs[0] === label) {
                    declineLabel = declineLabs[0];
                    break;
                  }
                  container = container.parentElement;
                }
                if (!declineLabel || !container) continue;
                usedJoin.add(joinInput);
                const stripChoice = (s) => s
                  .replace(/不參加|不参加|參加|参加|Participate|Do not participate/g, ' ')
                  .replace(/\\s+/g, ' ')
                  .trim();
                let section = stripChoice(container.innerText || '');
                const joinChecked = !!joinInput.checked;
                const declineInput = radioFor(declineLabel);
                const declineChecked = !!(declineInput && declineInput.checked);
                pairs.push({
                  section: section.slice(0, 80),
                  joinChecked,
                  declineChecked,
                  joinDisabled: !!joinInput.disabled,
                  declineDisabled: !!(declineInput && declineInput.disabled),
                });
              }

              return { rows, pairs, snippet, trialIdx };
            }"""
        )
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
