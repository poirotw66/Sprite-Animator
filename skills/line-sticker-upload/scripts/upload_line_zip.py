#!/usr/bin/env python3
"""Log in to LINE Creators Market and upload a sticker batch ZIP via Playwright."""

from __future__ import annotations

import argparse
import os
import re
import time
from pathlib import Path

# Windows: keep Unicode literals and stdout stable
os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout, sync_playwright

from line_playwright_common import (
    PROJECT_ROOT,
    dismiss_overlays,
    get_storage,
    load_env,
    sticker_detail_url,
    sticker_image_url,
)

ZIP_UPLOAD_TEXT = "\u4e0a\u50b3\u58d3\u7e2e\u6a94"  # 上傳壓縮檔


def dismiss_modals(page: Page) -> None:
    dismiss_overlays(page)


def click_consent_if_present(page: Page) -> None:
    for pattern in (
        r"\u540c\u610f",
        r"\u5141\u8a31",
        r"Allow",
        r"Agree",
        r"\u7e7c\u7e7c",
    ):
        btn = page.get_by_role("button", name=re.compile(pattern, re.I))
        if btn.count() > 0:
            try:
                btn.first.click(timeout=3_000)
                page.wait_for_timeout(1_000)
                return
            except PlaywrightTimeout:
                continue


def fill_line_login(page: Page, email: str, password: str) -> None:
    email_input = page.locator(
        "input[type='email'], input[name='tid'], input[autocomplete='email']"
    ).first
    email_input.wait_for(state="visible", timeout=20_000)
    email_input.fill(email)

    password_input = page.locator("input[type='password']").first
    password_input.click()
    password_input.press_sequentially(password, delay=40)
    page.wait_for_timeout(600)

    for selector in (
        "button[type='submit']",
        "button:has-text('Log in')",
        "button:has-text('\u767b\u5165')",
    ):
        btn = page.locator(selector)
        if btn.count() > 0 and btn.first.is_enabled():
            btn.first.click()
            return


def login_line(page: Page, email: str, password: str, two_fa_timeout_ms: int) -> None:
    if "access.line.me" not in page.url:
        page.goto("https://creator.line.me/zh-hant/", wait_until="domcontentloaded")
        page.wait_for_timeout(1_000)
        for link_name in (
            "\u500b\u4eba\u9801\u9762",
            "\u8acb\u9ede\u6b64\u8a3b\u518a",
        ):
            link = page.get_by_role("link", name=link_name)
            if link.count() > 0:
                link.first.click()
                break
        page.wait_for_url(re.compile(r"access\.line\.me"), timeout=30_000)

    fill_line_login(page, email, password)
    print("Complete 2FA on your phone if LINE asks for a verification code.", flush=True)

    deadline = time.monotonic() + two_fa_timeout_ms / 1000
    while time.monotonic() < deadline:
        url = page.url
        if "creator.line.me" in url and "/my/" in url:
            click_consent_if_present(page)
            dismiss_modals(page)
            return
        if "access.line.me" in url:
            click_consent_if_present(page)
        page.wait_for_timeout(1_000)
    raise PlaywrightTimeout("Login timed out before reaching Creators Market.")


def open_image_editor(page: Page, page_url: str) -> None:
    page.goto(page_url, wait_until="domcontentloaded", timeout=120_000)
    if "access.line.me" in page.url:
        raise RuntimeError("Still on LINE login; session not established.")
    dismiss_modals(page)
    page.locator(f"text={ZIP_UPLOAD_TEXT}").first.wait_for(state="visible", timeout=90_000)


def ensure_forty_stickers(page: Page) -> None:
    combo = page.get_by_role("combobox", name=re.compile("\u8b8a\u66f4\u8cbc\u5716\u5f35\u6578"))
    if combo.count() == 0:
        return
    value = combo.first.input_value()
    if value.startswith("40"):
        return
    combo.first.select_option("40")
    page.wait_for_timeout(500)
    ok = page.get_by_role("button", name="OK")
    if ok.count() > 0:
        ok.first.click()
        page.wait_for_timeout(1_500)


def upload_zip_file(page: Page, zip_path: Path) -> None:
    zip_file = str(zip_path.resolve())
    inputs = page.locator("input[type='file']")
    if inputs.count() > 0:
        inputs.first.set_input_files(zip_file)
        print(f"ZIP submitted via file input: {zip_path.name}", flush=True)
        return

    with page.expect_file_chooser(timeout=15_000) as chooser_info:
        page.locator(f"text={ZIP_UPLOAD_TEXT}").first.click()
    chooser_info.value.set_files(zip_file)
    print(f"ZIP submitted via file chooser: {zip_path.name}", flush=True)


def count_filled_sticker_slots(page: Page) -> tuple[int, int, list[str]]:
    """Count LINE editor slots with uploaded CDN images. Returns filled, total, empty labels."""
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(400)
    result = page.evaluate(
        """() => {
            const items = [...document.querySelectorAll('[data-test="product-image-key"]')].map((keyEl) => {
                const label = (keyEl.textContent || '').trim();
                const li = keyEl.closest('li');
                const inp = li ? li.querySelector('input.cm-product-image') : null;
                const src = inp ? (inp.getAttribute('src') || '') : '';
                const filled =
                    src.includes('line-scdn.net') ||
                    src.includes('line.me/sticker') ||
                    src.includes('line-cdn.net');
                return { label, filled };
            });
            const empty = items.filter((item) => !item.filled).map((item) => item.label);
            const filled = items.filter((item) => item.filled).length;
            return { filled, total: items.length, empty };
        }"""
    )
    return int(result["filled"]), int(result["total"]), list(result["empty"])


def wait_for_zip_import(
    page: Page,
    expected_stickers: int,
    *,
    timeout_sec: int = 600,
    min_wait_sec: int = 0,
) -> None:
    """Poll until main+tab+N stickers show CDN images, or raise on timeout."""
    expected_total = expected_stickers + 2
    if min_wait_sec > 0:
        print(f"ZIP import: initial wait {min_wait_sec}s…", flush=True)
        page.wait_for_timeout(min_wait_sec * 1000)

    deadline = time.monotonic() + timeout_sec
    last_filled = -1
    while time.monotonic() < deadline:
        filled, total, empty = count_filled_sticker_slots(page)
        if total >= expected_total and filled >= expected_total:
            print(f"ZIP import complete: {filled}/{total} slots filled.", flush=True)
            return
        if filled != last_filled:
            print(
                f"ZIP import progress: {filled}/{expected_total} slots filled "
                f"({len(empty)} remaining)…",
                flush=True,
            )
            last_filled = filled
        page.wait_for_timeout(3_000)

    _, _, empty = count_filled_sticker_slots(page)
    preview = ", ".join(empty[:15])
    if len(empty) > 15:
        preview += f", … (+{len(empty) - 15} more)"
    raise PlaywrightTimeout(
        f"ZIP import incomplete after {timeout_sec}s — empty slots: {preview or 'unknown'}"
    )


def pause_after_zip(page: Page, seconds: int) -> None:
    """Legacy fixed delay; prefer wait_for_zip_import."""
    if seconds <= 0:
        return
    print(
        f"ZIP upload handed to the browser; pausing {seconds}s before saving session.",
        flush=True,
    )
    page.wait_for_timeout(seconds * 1000)


def run(
    page_url: str,
    zip_path: Path,
    email: str,
    password: str,
    two_fa_timeout_sec: int,
    post_upload_pause_sec: int,
    reuse_session: bool,
    *,
    headless: bool = False,
    sticker_count: int = 40,
    import_timeout_sec: int = 600,
    wait_for_import: bool = True,
) -> None:
    if not zip_path.is_file():
        raise SystemExit(f"ZIP not found: {zip_path}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=headless)
        if reuse_session and get_storage().is_file():
            context = browser.new_context(
                storage_state=str(get_storage()),
                locale="zh-TW",
            )
            print("Reusing saved LINE session (skips login when possible).", flush=True)
        else:
            context = browser.new_context(locale="zh-TW")

        page = context.new_page()
        page.goto(page_url, wait_until="domcontentloaded", timeout=60_000)

        needs_login = "access.line.me" in page.url or (
            "creator.line.me/zh-hant" in page.url and "/my/" not in page.url
        )
        if needs_login:
            login_line(page, email, password, two_fa_timeout_sec * 1000)

        open_image_editor(page, page_url)
        ensure_forty_stickers(page)
        upload_zip_file(page, zip_path)
        if wait_for_import:
            wait_for_zip_import(
                page,
                sticker_count,
                timeout_sec=import_timeout_sec,
                min_wait_sec=post_upload_pause_sec,
            )
        else:
            pause_after_zip(page, post_upload_pause_sec)

        storage = get_storage()
        context.storage_state(path=str(storage))
        print(f"Done. Session saved to {storage.name}", flush=True)
        browser.close()


DEFAULT_ZIP = PROJECT_ROOT / "upload-ready.zip"


def resolve_zip_path(cli_zip: Path, env: dict[str, str]) -> Path:
    resolved = cli_zip.resolve()
    default_resolved = DEFAULT_ZIP.resolve()
    if resolved == default_resolved:
        relative = env.get("UPLOAD_ZIP", "").strip()
        if relative:
            for root in (PROJECT_ROOT, Path.cwd()):
                candidate = (root / relative).resolve()
                if candidate.is_file():
                    return candidate
    if not resolved.is_file():
        raise SystemExit(f"ZIP not found: {resolved}")
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(description="LINE sticker ZIP upload via Playwright.")
    parser.add_argument(
        "--url",
        default="",
        help="Image editor URL; default from LINE_CREATOR_ID + LINE_STICKER_ID in .env",
    )
    parser.add_argument("--zip", type=Path, default=DEFAULT_ZIP)
    parser.add_argument(
        "--env",
        type=Path,
        required=True,
        help="Per-set batch env (e.g. output/my-set/.env.batch/Set_Name.env)",
    )
    parser.add_argument("--two-fa-timeout", type=int, default=120)
    parser.add_argument(
        "--post-upload-pause",
        type=int,
        default=0,
        help="Minimum seconds to wait before polling import progress (fixed delay if --no-wait-import)",
    )
    parser.add_argument(
        "--import-timeout",
        type=int,
        default=600,
        help="Max seconds to wait for all sticker slots to fill after ZIP upload",
    )
    parser.add_argument(
        "--no-wait-import",
        action="store_true",
        help="Skip import polling (legacy: only use --post-upload-pause delay)",
    )
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--no-reuse-session", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env)
    email = env.get("LINE_EMAIL", "")
    password = env.get("LINE_PASSWORD", "")
    if not email or not password:
        raise SystemExit("LINE_EMAIL and LINE_PASSWORD must be set in .env")

    page_url = args.url.strip()
    if not page_url:
        creator = env.get("LINE_CREATOR_ID", "")
        sticker_id = env.get("LINE_STICKER_ID", "")
        if not creator or not sticker_id:
            raise SystemExit("Set LINE_CREATOR_ID and LINE_STICKER_ID in .env, or pass --url.")
        page_url = sticker_image_url(creator, sticker_id)

    zip_path = resolve_zip_path(args.zip, env)
    sticker_count = int(env.get("STICKER_COUNT", "40") or "40")

    run(
        page_url=page_url,
        zip_path=zip_path,
        email=email,
        password=password,
        two_fa_timeout_sec=args.two_fa_timeout,
        post_upload_pause_sec=args.post_upload_pause,
        reuse_session=not args.no_reuse_session,
        headless=bool(args.headless),
        sticker_count=sticker_count,
        import_timeout_sec=args.import_timeout,
        wait_for_import=not args.no_wait_import,
    )

    creator = env.get("LINE_CREATOR_ID", "").strip()
    sticker_id = env.get("LINE_STICKER_ID", "").strip()
    if creator and sticker_id:
        print(f"PROJECT_URL={sticker_detail_url(creator, sticker_id)}", flush=True)


if __name__ == "__main__":
    main()
