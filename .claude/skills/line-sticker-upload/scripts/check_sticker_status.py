#!/usr/bin/env python3
"""Print LINE sticker project review status as one JSON line on stdout.

Usage:
    python check_sticker_status.py --env output/.../Set_Name.env [--headless]
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import sync_playwright

from line_playwright_common import get_storage, load_env, sticker_detail_url
from submit_line_review import detect_review_status, ensure_logged_in


def main() -> None:
    parser = argparse.ArgumentParser(description="Check LINE sticker project review status.")
    parser.add_argument("--env", type=Path, required=True)
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env)
    creator = env.get("LINE_CREATOR_ID", "").strip()
    sticker_id = env.get("LINE_STICKER_ID", "").strip()
    if not creator or not sticker_id:
        print(json.dumps({"status": "unknown", "reason": "missing_ids"}), flush=True)
        return

    detail_url = sticker_detail_url(creator, sticker_id)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=bool(args.headless))
        storage = get_storage()
        context = browser.new_context(
            storage_state=str(storage) if storage.is_file() else None,
            locale="zh-TW",
        )
        page = context.new_page()
        ensure_logged_in(page, env, detail_url)
        status = detect_review_status(page) or "unknown"
        browser.close()

    print(json.dumps({"status": status, "sticker_id": sticker_id}), flush=True)


if __name__ == "__main__":
    main()
