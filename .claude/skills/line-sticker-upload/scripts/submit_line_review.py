#!/usr/bin/env python3
"""Submit LINE sticker set for review via Playwright."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout, sync_playwright

from line_playwright_common import (
    PROJECT_ROOT,
    dismiss_overlays,
    get_storage,
    load_env,
    sticker_detail_url,
)
from upload_line_zip import login_line

SUBMIT_BTN = '[data-test="detail-btn-request"] a.mdBtn'
DIALOG_OK = '[data-test="dialog-btn-ok"]'


def accept_terms_and_confirm(page: Page) -> None:
    page.wait_for_function(
        """() => {
            const check = [...document.querySelectorAll('input.mdInputCheck')]
                .find((el) => el.getBoundingClientRect().width > 0);
            const ok = [...document.querySelectorAll('[data-test="dialog-btn-ok"]')]
                .find((el) => el.getBoundingClientRect().width > 0);
            return Boolean(check || ok);
        }""",
        timeout=20_000,
    )
    page.evaluate(
        """() => {
            const check = [...document.querySelectorAll('input.mdInputCheck')]
                .find((el) => el.getBoundingClientRect().width > 0);
            if (check && !check.checked) check.click();
            const okSpan = [...document.querySelectorAll('[data-test="dialog-btn-ok"]')]
                .find((el) => el.getBoundingClientRect().width > 0);
            okSpan?.closest('button')?.click();
        }"""
    )
    page.wait_for_timeout(2_000)

    for _ in range(3):
        clicked = page.evaluate(
            """() => {
                const okSpan = [...document.querySelectorAll('[data-test="dialog-btn-ok"]')]
                    .find((el) => el.getBoundingClientRect().width > 0);
                if (!okSpan) return false;
                okSpan.closest('button')?.click();
                return true;
            }"""
        )
        if not clicked:
            break
        page.wait_for_timeout(1_000)


def click_submit_button(page: Page) -> None:
    if not submit_button_visible(page):
        status = detect_review_status(page)
        if status == "waiting_for_review":
            return
        raise PlaywrightTimeout(
            "Submit button not visible and status is not 等待審核 / 審核中."
        )
    submit_btn = page.locator(SUBMIT_BTN)
    submit_btn.wait_for(state="visible", timeout=30_000)
    for _ in range(5):
        dismiss_overlays(page)
        submit_btn.click(force=True, timeout=15_000)
        page.wait_for_timeout(1_500)
        opened = page.evaluate(
            """() => [...document.querySelectorAll('[data-test="dialog-btn-ok"]')]
                .some((el) => el.getBoundingClientRect().width > 0)"""
        )
        if opened:
            return
    raise PlaywrightTimeout("Submit dialog did not open after clicking 送出申請.")


WAITING_LABELS = ("\u7b49\u5f85\u5be9\u6838", "\u5be9\u6838\u4e2d")
EDITING_LABEL = "\u7de8\u8f2f\u4e2d"


def read_status_from_text(text: str) -> str | None:
    if any(label in text for label in WAITING_LABELS):
        return "waiting_for_review"
    if EDITING_LABEL in text:
        return "editing"
    return None


def submit_button_visible(page: Page) -> bool:
    return bool(
        page.evaluate(
            """() => {
                const el = document.querySelector('[data-test="detail-btn-request"] a.mdBtn');
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            }"""
        )
    )


def collect_visible_status_labels(page: Page) -> list[str]:
    """Read short visible status chips on the project header (more reliable than body text)."""
    return page.evaluate(
        f"""() => {{
            const needles = {list(WAITING_LABELS + (EDITING_LABEL,))!r};
            const found = new Set();
            for (const el of document.querySelectorAll('*')) {{
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) continue;
                const t = (el.innerText || el.textContent || '').trim();
                if (!t || t.length > 40) continue;
                for (const n of needles) {{
                    if (t.includes(n)) found.add(n);
                }}
            }}
            return [...found];
        }}"""
    )


def detect_review_status(page: Page) -> str | None:
    page.wait_for_timeout(2_000)
    labels = collect_visible_status_labels(page)
    if any(label in WAITING_LABELS for label in labels):
        return "waiting_for_review"
    if EDITING_LABEL in labels:
        return "editing"

    body_text = page.inner_text("body")
    from_body = read_status_from_text(body_text)
    if from_body:
        return from_body

    # Submitted sets hide「送出申請」; do not treat missing button as failure.
    if not submit_button_visible(page):
        if EDITING_LABEL not in body_text:
            return "waiting_for_review"
    return None


def ensure_logged_in(page: Page, env: dict[str, str], sticker_url: str) -> None:
    email = env.get("LINE_EMAIL", "").strip()
    password = env.get("LINE_PASSWORD", "").strip()
    if not email or not password:
        raise SystemExit("LINE_EMAIL and LINE_PASSWORD required in .env for login.")
    page.goto(sticker_url, wait_until="domcontentloaded", timeout=90_000)
    if "access.line.me" in page.url or (
        "creator.line.me" in page.url and "/my/" not in page.url
    ):
        login_line(page, email, password, 120_000)
        page.goto(sticker_url, wait_until="networkidle", timeout=90_000)


def submit(page: Page, env: dict[str, str], sticker_url: str) -> str:
    ensure_logged_in(page, env, sticker_url)
    page.evaluate("window.scrollTo(0, 0)")
    dismiss_overlays(page)

    existing = detect_review_status(page)
    if existing == "waiting_for_review":
        return existing

    click_submit_button(page)
    if detect_review_status(page) == "waiting_for_review":
        return "waiting_for_review"

    accept_terms_and_confirm(page)
    page.wait_for_timeout(2_000)
    return detect_review_status(page) or "unknown"


def main() -> None:
    parser = argparse.ArgumentParser(description="Submit LINE sticker for review.")
    parser.add_argument(
        "--env",
        type=Path,
        required=True,
        help="Per-set batch env (e.g. output/my-set/.env.batch/Set_Name.env)",
    )
    parser.add_argument("--url", default="", help="Sticker detail URL (overrides .env IDs)")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    storage = get_storage()
    if not storage.is_file():
        raise SystemExit(
            f"Missing session: {storage.name}. Run upload_line_zip.py once to log in."
        )

    env = load_env(args.env)
    url = args.url.strip()
    if not url:
        creator = env.get("LINE_CREATOR_ID", "")
        sticker_id = env.get("LINE_STICKER_ID", "")
        if not creator or not sticker_id:
            raise SystemExit("Set LINE_CREATOR_ID and LINE_STICKER_ID in .env, or pass --url.")
        url = sticker_detail_url(creator, sticker_id)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=args.headless)
        context = browser.new_context(
            storage_state=str(storage),
            locale="zh-TW",
            viewport={"width": 1400, "height": 900},
        )
        page = context.new_page()
        status = submit(page, env, url)
        context.storage_state(path=str(storage))
        browser.close()

    labels = {
        "waiting_for_review": "OK — already 等待審核 / 審核中 (or just submitted).",
        "editing": "Still 編輯中 — submit may have failed.",
        "unknown": "Done — verify status on the project page.",
    }
    print(labels.get(status, status), flush=True)
    print(f"PROJECT_URL={url}", flush=True)


if __name__ == "__main__":
    main()
