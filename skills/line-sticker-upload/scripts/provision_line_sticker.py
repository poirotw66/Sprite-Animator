#!/usr/bin/env python3
"""Create a static sticker project on LINE Creators Market from .env (EN + zh-Hant, Drive URL)."""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

os.environ.setdefault("PYTHONUTF8", "1")

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout, sync_playwright

from line_playwright_common import (
    PROJECT_ROOT,
    dismiss_overlays,
    get_storage,
    load_env,
    normalize_en_description,
    normalize_en_title,
    normalize_zh_description,
    normalize_zh_title,
    sanitize_line_creators_en_text,
    sticker_detail_url,
    sync_env_from_md_path,
)
from upload_line_zip import login_line

SCRIPT_DIR = Path(__file__).resolve().parent


def dismiss_creator_announcements(page: Page) -> None:
    for pattern in (r"^\u95dc\u9589$", r"^Close$", r"^\u4ee5\u5f8c\u4e0d\u518d\u986f\u793a$"):
        btn = page.get_by_role("button", name=re.compile(pattern))
        for _ in range(6):
            if not btn.count():
                break
            try:
                if btn.first.is_visible():
                    btn.first.click(timeout=2_000)
                    page.wait_for_timeout(350)
            except PlaywrightTimeout:
                break


def configure_campaigns(page: Page, env: dict[str, str]) -> None:
    """LINE blocks save while a freemium campaign is active; opt out when JOIN_CAMPAIGNS=false."""
    join = env.get("JOIN_CAMPAIGNS", "false").lower() in ("1", "true", "yes")
    if join:
        return

    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(600)
    declined = page.evaluate(
        """() => {
            let count = 0;
            for (const label of document.querySelectorAll('label')) {
                const text = (label.innerText || label.textContent || '').trim();
                if (text === '不參加' || text === '不参加' || text === 'Do not participate') {
                    label.click();
                    count++;
                }
            }
            return count;
        }"""
    )
    if declined:
        print(f"Declined {declined} campaign(s) (JOIN_CAMPAIGNS=false)", flush=True)
    page.wait_for_timeout(800)


def dismiss_campaign_float(page: Page) -> None:
    for _ in range(8):
        overlay = page.locator("button.background-overlay")
        if overlay.count() and overlay.first.is_visible():
            overlay.first.click(force=True)
            page.wait_for_timeout(400)
        else:
            break


def dismiss_wizards(page: Page) -> None:
    dismiss_overlays(page)
    dismiss_creator_announcements(page)
    dismiss_campaign_float(page)
    for _ in range(12):
        clicked = False
        for pattern in (r"^OK$", r"^\u95dc\u9589$"):
            btn = page.get_by_role("button", name=re.compile(pattern))
            if btn.count():
                try:
                    if btn.first.is_visible():
                        btn.first.click(timeout=2_000)
                        clicked = True
                        page.wait_for_timeout(350)
                except PlaywrightTimeout:
                    pass
        if not clicked:
            break


def select_static_type(page: Page) -> None:
    if page.locator('input[name="meta[en][title]"]').count():
        return
    static = page.locator('input[name="sticker_type"][value="static"]')
    if static.count() == 0:
        raise PlaywrightTimeout("Sticker create form not found (static type or EN title).")
    static.click(force=True)


def fill_english(page: Page, env: dict[str, str]) -> None:
    title = normalize_en_title(env.get("STICKER_TITLE_EN", ""))
    desc = normalize_en_description(env.get("STICKER_DESC_EN", ""), title)
    page.fill('input[name="meta[en][title]"]', title)
    page.fill('textarea[name="meta[en][description]"]', desc)


def zh_title_locator(page: Page):
    return page.locator(
        'input[name="meta[zh-Hant][title]"], '
        'input[name="meta[zh_Hant][title]"], '
        'input[name="meta[zh-TW][title]"], '
        'input[name="meta[zh_TW][title]"]'
    )


def zh_desc_locator(page: Page):
    return page.locator(
        'textarea[name="meta[zh-Hant][description]"], '
        'textarea[name="meta[zh_Hant][description]"], '
        'textarea[name="meta[zh-TW][description]"], '
        'textarea[name="meta[zh_TW][description]"]'
    )


def select_traditional_chinese_option(page: Page) -> None:
    selects = page.locator("main.content select")
    if selects.count() == 0:
        selects = page.locator("select")
    if selects.count() == 0:
        raise SystemExit("Language select not found on sticker form.")
    primary = selects.first
    for label in ("Chinese (Traditional)", "\u7e41\u9ad4\u4e2d\u6587"):
        try:
            primary.select_option(label=label, timeout=5_000)
            return
        except PlaywrightTimeout:
            continue
    for value in ("zh-Hant", "zh_Hant", "zh-TW", "zh_TW"):
        try:
            primary.select_option(value=value, timeout=3_000)
            return
        except PlaywrightTimeout:
            continue
    raise SystemExit("Could not select Traditional Chinese in language dropdown.")


def click_add_language(page: Page) -> None:
    dismiss_wizards(page)
    for _ in range(6):
        dismiss_campaign_float(page)
        page.wait_for_timeout(200)

    clicked = page.evaluate(
        """() => {
            const btn = document.querySelector('[data-test="btn-add-language"]');
            if (!btn) return false;
            btn.scrollIntoView({ block: 'center', inline: 'center' });
            btn.click();
            return true;
        }"""
    )
    if not clicked:
        main = page.locator("main.content")
        add_btn = main.get_by_role("button", name=re.compile(r"^\u65b0\u589e$"))
        if add_btn.count():
            add_btn.first.click(force=True, timeout=15_000)
        else:
            raise SystemExit("Add-language button not found (btn-add-language / 新增).")
    page.wait_for_timeout(1_200)


def add_traditional_chinese(page: Page) -> None:
    dismiss_wizards(page)
    select_traditional_chinese_option(page)
    page.wait_for_timeout(400)
    click_add_language(page)
    zh_title_locator(page).first.wait_for(state="visible", timeout=20_000)
    page.wait_for_timeout(500)


def fill_chinese_fields(page: Page, env: dict[str, str]) -> None:
    zh_title = normalize_zh_title(env.get("STICKER_TITLE_ZH", ""))
    zh_desc = normalize_zh_description(env.get("STICKER_DESC_ZH", ""))
    if not zh_title:
        raise SystemExit("STICKER_TITLE_ZH missing in .env")

    title_loc = zh_title_locator(page)
    if title_loc.count() == 0:
        raise SystemExit("Traditional Chinese title field not found after add language.")
    title_loc.first.fill(zh_title)

    desc_loc = zh_desc_locator(page)
    if desc_loc.count() == 0:
        raise SystemExit("Traditional Chinese description field not found after add language.")
    desc_loc.first.fill(zh_desc)

    if title_loc.first.input_value().strip() != zh_title:
        raise SystemExit(
            f"Failed to fill zh title (got: {title_loc.first.input_value()!r})"
        )
    print(f"Filled zh title: {zh_title}", flush=True)
    print(f"Filled zh description ({len(zh_desc)} chars)", flush=True)


def fill_sale_block(page: Page, env: dict[str, str]) -> None:
    page.fill(
        'input[name="copyright"]',
        sanitize_line_creators_en_text(env.get("COPYRIGHT", "")),
    )
    use_ai = env.get("USE_AI", "true").lower() in ("1", "true", "yes")
    ai_val = "true" if use_ai else "false"
    page.locator(f'input[name="is_ai_generated"][value="{ai_val}"]').click(force=True)

    drive_url = env.get("GDRIVE_SHARE_URL", "").strip()
    if drive_url:
        page.fill('input[name="design_url"]', drive_url)
        page.keyboard.press("Tab")
        page.wait_for_timeout(2_500)

    page.locator('input[name="area_group"][value="all"]').click(force=True)

    auto_sale = env.get("SALE_START", "auto").lower() == "auto"
    release_val = "true" if auto_sale else "false"
    page.locator(f'input[name="is_auto_release"][value="{release_val}"]').click(force=True)
    configure_campaigns(page, env)


def scrape_validation_errors(page: Page) -> list[str]:
    return page.evaluate(
        """() => {
            const msgs = [];
            for (const el of document.querySelectorAll(
                '.error, .alert, .alert-danger, [class*="error"], [class*="invalid"], .help-block, p, span, div'
            )) {
                const t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
                if (!t || t.length > 240) continue;
                if (
                    t.includes('已被使用') ||
                    t.includes('已被採用') ||
                    /already (used|taken)/i.test(t) ||
                    t.includes('請使用其他標題') ||
                    t.includes('請使用其他說明')
                ) {
                    msgs.push(t);
                }
            }
            return [...new Set(msgs)].slice(0, 6);
        }"""
    )


def assert_no_duplicate_title_errors(page: Page) -> None:
    errors = scrape_validation_errors(page)
    if errors:
        joined = " | ".join(errors)
        raise SystemExit(f"LINE rejected duplicate title/description: {joined}")


def save_button_state(page: Page) -> dict | None:
    return page.evaluate(
        """() => {
            const el = document.querySelector('[data-test="btn-save"]');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
                disabled: el.disabled,
                ngDisabled: el.getAttribute('ng-disabled'),
                text: (el.innerText || el.textContent || '').trim(),
                visible: r.width > 0 && r.height > 0,
            };
        }"""
    )


def dump_provision_debug(page: Page, label: str) -> None:
    debug_dir = SCRIPT_DIR / "debug_snapshots"
    debug_dir.mkdir(exist_ok=True)
    safe = re.sub(r"[^\w.-]+", "_", label)[:80]
    shot = debug_dir / f"{safe}.png"
    page.screenshot(path=str(shot), full_page=True)
    state = save_button_state(page)
    errors = scrape_validation_errors(page)
    print(f"DEBUG url={page.url}", flush=True)
    print(f"DEBUG save_button={state}", flush=True)
    if errors:
        print(f"DEBUG validation_errors={errors}", flush=True)
    print(f"DEBUG screenshot={shot}", flush=True)


def wait_for_save_enabled(page: Page, timeout_ms: int = 90_000) -> None:
    save_btn = page.locator('[data-test="btn-save"]')
    save_btn.wait_for(state="attached", timeout=timeout_ms)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-test="btn-save"]');
            if (!el || el.offsetParent === null) return false;
            return !el.disabled;
        }""",
        timeout=timeout_ms,
    )


def click_save(page: Page) -> None:
    dismiss_campaign_float(page)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    wait_for_save_enabled(page)
    clicked = page.evaluate(
        """() => {
            const el = document.querySelector('[data-test="btn-save"]');
            if (!el) return false;
            el.scrollIntoView({ block: 'center', inline: 'center' });
            el.click();
            return true;
        }"""
    )
    if not clicked:
        raise SystemExit("Save button not found on sticker form.")
    page.wait_for_timeout(800)


def confirm_save_dialog(page: Page) -> None:
    page.wait_for_timeout(400)
    for pattern in (r"^\u78ba\u5b9a$", r"^OK$"):
        btn = page.get_by_role("button", name=re.compile(pattern))
        if btn.count():
            try:
                btn.first.click(force=True, timeout=4_000)
                page.wait_for_timeout(600)
            except PlaywrightTimeout:
                continue


def wait_for_sticker_project_url(page: Page, timeout_ms: int = 120_000) -> None:
    # LINE may prefix pathname with a locale segment (e.g. /zh-TW/my/.../sticker/123).
    page.wait_for_function(
        """() => /\\/sticker\\/\\d+(?:\\/|$)/.test(location.pathname)""",
        timeout=timeout_ms,
    )


def extract_sticker_id(url: str) -> str | None:
    m = re.search(r"/sticker/(\d+)", url)
    return m.group(1) if m else None


def update_env_sticker_id(env_path: Path, sticker_id: str) -> None:
    text = env_path.read_text(encoding="utf-8")
    if re.search(r"^LINE_STICKER_ID=.*$", text, flags=re.MULTILINE):
        text = re.sub(
            r"^LINE_STICKER_ID=.*$",
            f"LINE_STICKER_ID={sticker_id}",
            text,
            flags=re.MULTILINE,
        )
    else:
        text = text.rstrip() + f"\nLINE_STICKER_ID={sticker_id}\n"
    env_path.write_text(text, encoding="utf-8")


def create_browser_context(browser, storage: Path):
    context_kwargs = {
        "locale": "zh-TW",
        "viewport": {"width": 1400, "height": 900},
    }
    if storage.is_file():
        context_kwargs["storage_state"] = str(storage)
    return browser.new_context(**context_kwargs)


def ensure_creators_logged_in(page: Page, env: dict[str, str], target_url: str) -> None:
    email = env.get("LINE_EMAIL", "").strip()
    password = env.get("LINE_PASSWORD", "").strip()
    if not email or not password:
        raise SystemExit("LINE_EMAIL and LINE_PASSWORD required in .env for login.")
    page.goto(target_url, wait_until="domcontentloaded", timeout=120_000)
    needs_login = "access.line.me" in page.url or (
        "creator.line.me" in page.url and "/my/" not in page.url
    )
    if needs_login:
        login_line(page, email, password, 120_000)
        page.goto(target_url, wait_until="networkidle", timeout=120_000)


def ensure_chinese_fields(page: Page, env: dict[str, str]) -> None:
    if zh_title_locator(page).count() == 0:
        add_traditional_chinese(page)
    fill_chinese_fields(page, env)


def save_sticker_form(
    page: Page, *, pause_before_save: bool = False, debug_label: str = "provision"
) -> tuple[str, str]:
    dismiss_campaign_float(page)
    if pause_before_save:
        wait_for_user_verification()
    assert_no_duplicate_title_errors(page)
    click_save(page)
    for _ in range(8):
        confirm_save_dialog(page)
        dismiss_campaign_float(page)
        try:
            wait_for_sticker_project_url(page, timeout_ms=3_000)
            break
        except PlaywrightTimeout:
            continue
    try:
        wait_for_sticker_project_url(page, timeout_ms=120_000)
    except PlaywrightTimeout:
        dump_provision_debug(page, debug_label)
        raise
    final_url = page.url
    sid = extract_sticker_id(final_url)
    if not sid:
        raise SystemExit(f"No sticker id in URL: {final_url}")
    return sid, final_url


def wait_for_user_verification() -> None:
    print(
        "Review the form in the browser. Press Enter here to save and continue "
        "(or close the browser to cancel).",
        flush=True,
    )
    try:
        input()
    except EOFError:
        pass


def find_sticker_id_from_list(page: Page, creator: str, query: str) -> str | None:
    if not query.strip():
        return None
    list_url = (
        f"https://creator.line.me/my/{creator}/sticker/"
        f"?status=all&query={query}&page=1"
    )
    page.goto(list_url, wait_until="networkidle", timeout=120_000)
    dismiss_wizards(page)
    found = page.evaluate(
        """() => {
            for (const a of document.querySelectorAll('a[href*="/sticker/"]')) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\\/sticker\\/(\\d+)/);
                if (m) return m[1];
            }
            return null;
        }"""
    )
    return str(found) if found else None


def provision(
    page: Page, env: dict[str, str], *, pause_before_save: bool = False, debug_label: str = "provision"
) -> tuple[str, str]:
    creator = env.get("LINE_CREATOR_ID", "").strip()
    if not creator:
        raise SystemExit("LINE_CREATOR_ID missing in .env")

    existing_id = env.get("LINE_STICKER_ID", "").strip()
    if not existing_id:
        for query in (env.get("STICKER_TITLE_EN", ""), env.get("STICKER_TITLE_ZH", "")):
            found = find_sticker_id_from_list(page, creator, query.strip())
            if found:
                existing_id = found
                print(f"Reusing existing LINE project {found} (matched {query!r})", flush=True)
                break
    if existing_id:
        env["LINE_STICKER_ID"] = existing_id
        return update_existing(
            page, env, pause_before_save=pause_before_save, debug_label=debug_label
        )

    create_url = f"https://creator.line.me/my/{creator}/sticker/create"
    ensure_creators_logged_in(page, env, create_url)
    dismiss_wizards(page)
    select_static_type(page)
    fill_english(page, env)
    ensure_chinese_fields(page, env)
    fill_sale_block(page, env)
    return save_sticker_form(page, pause_before_save=pause_before_save, debug_label=debug_label)


def open_sticker_edit_form(
    page: Page, env: dict[str, str], creator: str, sticker_id: str
) -> None:
    """Open metadata edit form from project list (detail page has no form fields)."""
    title_en = env.get("STICKER_TITLE_EN", "").strip()
    queries = [title_en, env.get("STICKER_TITLE_ZH", "").strip(), sticker_id]
    for query in queries:
        if not query:
            continue
        list_url = (
            f"https://creator.line.me/my/{creator}/sticker/"
            f"?status=all&query={query}&page=1"
        )
        page.goto(list_url, wait_until="networkidle", timeout=120_000)
        dismiss_wizards(page)
        opened = page.evaluate(
            """(sid) => {
                for (const a of document.querySelectorAll('a[href*="/sticker/"]')) {
                    const href = a.getAttribute('href') || '';
                    if (!href.includes('/sticker/' + sid)) continue;
                    let node = a;
                    for (let i = 0; i < 8 && node; i++) {
                        for (const el of node.querySelectorAll('a, button')) {
                            const t = (el.innerText || el.textContent || '').trim();
                            if (t === '編輯' || t === 'Edit') {
                                el.click();
                                return true;
                            }
                        }
                        node = node.parentElement;
                    }
                }
                return false;
            }""",
            sticker_id,
        )
        if opened:
            page.wait_for_timeout(1_500)
            if page.locator('input[name="meta[en][title]"]').count():
                return
    raise SystemExit(
        f"Could not open edit form for sticker {sticker_id}. "
        "Check LINE_STICKER_ID or create a new project (omit --update)."
    )


def update_existing(
    page: Page, env: dict[str, str], *, pause_before_save: bool = False, debug_label: str = "update"
) -> tuple[str, str]:
    creator = env.get("LINE_CREATOR_ID", "").strip()
    sticker_id = env.get("LINE_STICKER_ID", "").strip()
    if not creator:
        raise SystemExit("LINE_CREATOR_ID missing in .env")
    if not sticker_id:
        raise SystemExit("LINE_STICKER_ID missing in .env (required for --update).")

    edit_url = sticker_detail_url(creator, sticker_id)
    ensure_creators_logged_in(page, env, edit_url)
    dismiss_wizards(page)
    if page.locator('input[name="meta[en][title]"]').count() == 0:
        open_sticker_edit_form(page, env, creator, sticker_id)
    page.locator('input[name="meta[en][title]"]').wait_for(state="visible", timeout=90_000)
    fill_english(page, env)
    ensure_chinese_fields(page, env)
    fill_sale_block(page, env)
    return save_sticker_form(page, pause_before_save=pause_before_save, debug_label=debug_label)


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision LINE sticker project from .env")
    view = parser.add_mutually_exclusive_group()
    view.add_argument(
        "--headless",
        action="store_true",
        help="Run without a visible browser window (automation/CI).",
    )
    view.add_argument(
        "--headed",
        action="store_true",
        help="Show browser explicitly (same as default when neither flag is passed).",
    )
    parser.add_argument(
        "--pause-before-save",
        action="store_true",
        help="Wait for Enter before saving the form (debug / manual review).",
    )
    parser.add_argument(
        "--no-pause-before-save",
        action="store_true",
        help="Save immediately without waiting for Enter.",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update existing project from LINE_STICKER_ID in .env (not create new).",
    )
    parser.add_argument(
        "--env",
        type=Path,
        required=True,
        help="Per-set batch env (e.g. output/my-set/.env.batch/Set_Name.env)",
    )
    args = parser.parse_args()

    env_path = args.env.resolve()
    if sync_env_from_md_path(env_path):
        print("Synced sticker text from .md to .env", flush=True)
    env = load_env(env_path)
    storage = get_storage()

    headless = bool(args.headless)
    pause_before_save = bool(args.pause_before_save) and not args.no_pause_before_save

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = create_browser_context(browser, storage)
        page = ctx.new_page()
        action = update_existing if args.update else provision
        sticker_id, final_url = action(
            page, env, pause_before_save=pause_before_save, debug_label=env_path.stem
        )
        ctx.storage_state(path=str(storage))
        browser.close()

    update_env_sticker_id(env_path, sticker_id)
    print(f"LINE_STICKER_ID={sticker_id}", flush=True)
    print(f"PROJECT_URL={final_url}", flush=True)


if __name__ == "__main__":
    main()
