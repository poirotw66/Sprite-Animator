#!/usr/bin/env python3
"""Upload local PNGs to Google Drive folder via Playwright file chooser."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

STORAGE = Path(__file__).resolve().parent / "playwright_drive_state.json"


def collect_files(local_dir: Path) -> list[str]:
    paths = sorted(local_dir.glob("*.png"))
    if not paths:
        raise SystemExit(f"No PNG files in {local_dir}")
    return [str(p.resolve()) for p in paths]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("local_dir", type=Path)
    parser.add_argument("--folder-url", required=True)
    parser.add_argument("--login-wait", type=int, default=90, help="Seconds to wait for manual login")
    args = parser.parse_args()

    files = collect_files(args.local_dir)
    print(f"Uploading {len(files)} files from {args.local_dir}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = (
            browser.new_context(storage_state=str(STORAGE))
            if STORAGE.is_file()
            else browser.new_context()
        )
        page = context.new_page()
        page.goto(args.folder_url, wait_until="domcontentloaded")
        print(f"If not logged in, sign in within {args.login_wait}s...")
        page.wait_for_timeout(args.login_wait * 1000)

        page.get_by_role("button", name="新增").click()
        with page.expect_file_chooser(timeout=15000) as fc_info:
            page.get_by_role("menuitem", name="檔案上傳").click()
        fc_info.value.set_files(files)
        print("Files selected; waiting for upload...")
        page.wait_for_timeout(120_000)
        context.storage_state(path=str(STORAGE))
        browser.close()
    print("Done.")


if __name__ == "__main__":
    main()
