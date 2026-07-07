#!/usr/bin/env python3
"""Shared helpers for LINE Creators Market Playwright scripts."""

from __future__ import annotations

import os
import re
from pathlib import Path

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[4]
STORAGE = SCRIPT_DIR / "playwright_line_state.json"


def get_storage() -> Path:
    override = os.environ.get("LINE_PLAYWRIGHT_STATE", "").strip()
    if override:
        return Path(override)
    return STORAGE


def load_env(path: Path | None = None) -> dict[str, str]:
    env_path = path or PROJECT_ROOT / ".env"
    env: dict[str, str] = {}
    if not env_path.is_file():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def sticker_detail_url(creator_id: str, sticker_id: str) -> str:
    return f"https://creator.line.me/my/{creator_id}/sticker/{sticker_id}"


def sticker_image_url(creator_id: str, sticker_id: str) -> str:
    return f"{sticker_detail_url(creator_id, sticker_id)}/image"


def dismiss_overlays(page: Page) -> None:
    for _ in range(5):
        overlay = page.locator("button.background-overlay")
        if overlay.count() and overlay.first.is_visible():
            try:
                overlay.first.click(force=True, timeout=2_000)
                page.wait_for_timeout(400)
            except PlaywrightTimeout:
                pass
        for label in (r"\u95dc\u9589", r"\u4ee5\u5f8c\u4e0d\u518d\u986f\u793a"):
            btn = page.get_by_role("button", name=re.compile(label))
            if btn.count():
                try:
                    btn.first.click(force=True, timeout=1_500)
                except PlaywrightTimeout:
                    pass
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        if not overlay.count() or not overlay.first.is_visible():
            break


STICKER_TEXT_KEYS = (
    "STICKER_TITLE_ZH",
    "STICKER_DESC_ZH",
    "STICKER_TITLE_EN",
    "STICKER_DESC_EN",
)


def parse_sticker_md(md_path: Path) -> dict[str, str]:
    text = md_path.read_text(encoding="utf-8").replace("\\---", "---")
    zh_parts = re.split(
        r"^#\s+Traditional Chinese.*$", text, maxsplit=1, flags=re.MULTILINE | re.I
    )
    tail = zh_parts[1] if len(zh_parts) > 1 else text
    en_parts = re.split(r"^---\s*$", tail, maxsplit=1, flags=re.MULTILINE)
    zh_block = en_parts[0] if en_parts else tail
    en_tail = en_parts[1] if len(en_parts) > 1 else ""
    en_sections = re.split(
        r"^#\s+English\s*$", en_tail, maxsplit=1, flags=re.MULTILINE | re.I
    )
    en_block = en_sections[1] if len(en_sections) > 1 else en_tail

    def pick(block: str, label: str) -> str:
        m = re.search(
            rf"##\s+{label}\s*\n+(.*?)(?=\n##|\n---|\Z)",
            block,
            flags=re.DOTALL | re.I,
        )
        if not m:
            return ""
        return " ".join(m.group(1).split())

    return {
        "STICKER_TITLE_ZH": pick(zh_block, "Title"),
        "STICKER_DESC_ZH": pick(zh_block, "Description"),
        "STICKER_TITLE_EN": pick(en_block, "Title"),
        "STICKER_DESC_EN": pick(en_block, "Description"),
    }


EN_TITLE_MAX_LEN = 39  # LINE Creators English title: fewer than 40 characters
ZH_TITLE_MAX_LEN = 20  # LINE Creators Traditional Chinese title: at most 20 characters
ZH_DESC_MAX_LEN = 80  # LINE Creators Traditional Chinese description: at most 80 characters


def normalize_zh_text(value: str) -> str:
    return " ".join(value.split()).strip()


def normalize_zh_title(title: str, max_len: int = ZH_TITLE_MAX_LEN) -> str:
    out = normalize_zh_text(title)
    if len(out) <= max_len:
        return out
    return out[:max_len]


def normalize_zh_description(desc: str, max_len: int = ZH_DESC_MAX_LEN) -> str:
    out = normalize_zh_text(desc)
    if len(out) <= max_len:
        return out
    return out[:max_len]


def normalize_sticker_meta(meta: dict[str, str], set_dir_name: str = "") -> dict[str, str]:
    """Apply LINE Creators field limits to parsed md metadata."""
    raw_en_title = meta.get("STICKER_TITLE_EN") or set_dir_name
    title_en = normalize_en_title(raw_en_title)
    meta["STICKER_TITLE_EN"] = title_en
    meta["STICKER_TITLE_ZH"] = normalize_zh_title(meta.get("STICKER_TITLE_ZH", ""))
    meta["STICKER_DESC_ZH"] = normalize_zh_description(meta.get("STICKER_DESC_ZH", ""))
    meta["STICKER_DESC_EN"] = normalize_en_description(
        meta.get("STICKER_DESC_EN", ""), title_en
    )
    return meta


def sanitize_line_creators_en_text(value: str) -> str:
    """LINE English fields: half-width Latin letters, digits, and half-width symbols only."""
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2212": "-",
        "\u2026": "...",
        "\u00a0": " ",
        "\u00a9": "(c)",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    out = value
    for old, new in replacements.items():
        out = out.replace(old, new)
    out = "".join(ch for ch in out if ord(ch) < 128)
    return " ".join(out.split()).strip()


def normalize_en_title(title: str, max_len: int = EN_TITLE_MAX_LEN) -> str:
    """Half-width ASCII title within LINE Creators limit (< 40 chars)."""
    out = sanitize_line_creators_en_text(title)
    if len(out) <= max_len:
        return out
    shortened = re.sub(r": My ", ": ", out)
    shortened = re.sub(r" with a Hound$", "", shortened, flags=re.I)
    if len(shortened) <= max_len:
        return shortened
    truncated = shortened[: max_len + 1].rsplit(" ", 1)[0]
    return truncated.rstrip(":- ")


def normalize_en_description(desc: str, title_en: str) -> str:
    """Half-width ASCII, includes Sticker, max 160 chars (LINE Creators)."""
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u00a9": "(c)",
        "\u2018": "'",
        "\u2019": "'",
    }
    out = desc
    for old, new in replacements.items():
        out = out.replace(old, new)
    out = "".join(ch for ch in out if ord(ch) < 128)
    out = " ".join(out.split()).strip()
    prefix = f"{title_en} Sticker set. "
    if " Sticker set." in out:
        combined = out
    else:
        combined = prefix + out
    if len(combined) > 160:
        combined = combined[:160].rstrip()
    return combined


def resolve_set_dir_from_env(env: dict[str, str]) -> Path | None:
    for key in ("UPLOAD_ZIP", "SOURCE_ZIP"):
        rel = env.get(key, "").strip()
        if not rel:
            continue
        parent = (PROJECT_ROOT / rel).resolve().parent
        if parent.is_dir():
            return parent
    return None


def sync_sticker_text_to_env(env_path: Path, set_dir: Path) -> bool:
    md_files = sorted(set_dir.glob("*.md"))
    if not md_files:
        return False

    meta = parse_sticker_md(md_files[0])
    meta = normalize_sticker_meta(meta, set_dir.name)

    lines = env_path.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = (
            line.split("=", 1)[0].strip()
            if "=" in line and not line.strip().startswith("#")
            else ""
        )
        if key in STICKER_TEXT_KEYS:
            out.append(f"{key}={meta[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key in STICKER_TEXT_KEYS:
        if key not in seen:
            out.append(f"{key}={meta[key]}")
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return True


def sync_env_from_md_path(env_path: Path | None = None) -> bool:
    env_path = env_path or PROJECT_ROOT / ".env"
    env = load_env(env_path)
    set_dir = resolve_set_dir_from_env(env)
    if set_dir is None:
        return False
    return sync_sticker_text_to_env(env_path, set_dir)
