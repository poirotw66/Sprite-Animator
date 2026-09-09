#!/usr/bin/env python3
"""Patch configure_campaigns in provision_line_sticker.py."""

from __future__ import annotations

from pathlib import Path

NEW = r'''def configure_campaigns(page: Page, env: dict[str, str]) -> None:
    """Select LINE special-campaign participation.

    JOIN_CAMPAIGNS values:
      - false / 0 / no -> all campaign sections decline
      - true / 1 / yes / all -> all campaign sections join
      - comma-separated keywords -> join matching titles only
        e.g. JOIN_CAMPAIGNS=超值,拼貼,免費試用

    Free-trial requires 超值方案 first; clicks are ordered and verified
    because LINE resets 免費試用 if prerequisites are not live yet.
    """
    raw = (env.get("JOIN_CAMPAIGNS") or "false").strip()
    lowered = raw.lower()
    if lowered in ("0", "false", "no", "none", "off"):
        mode = "none"
        keywords: list[str] = []
    elif lowered in ("1", "true", "yes", "all", "on"):
        mode = "all"
        keywords = []
    else:
        mode = "keywords"
        keywords = [part.strip() for part in raw.replace(";", ",").split(",") if part.strip()]

    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(600)

    discover_js = """() => {
        const joinTexts = new Set(['參加', '参加', 'Participate']);
        const declineTexts = new Set(['不參加', '不参加', 'Do not participate']);
        const titleHints = ['超值', '拼貼', '試用', '特輯', '企劃', '方案', '活動', '功能', 'value', 'trial', 'collage'];
        const labelText = (el) => (el.innerText || el.textContent || '').trim();
        const radioFor = (label) => {
            const nested = label.querySelector('input[type="radio"]');
            if (nested) return nested;
            const id = label.getAttribute('for');
            return id ? document.getElementById(id) : null;
        };
        const stripChoice = (s) => (s || '')
            .replace(/不參加|不参加|參加|参加|Participate|Do not participate/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim();
        const findTitle = (container) => {
            let node = container;
            for (let depth = 0; depth < 8 && node; depth++) {
                let sib = node.previousElementSibling;
                for (let i = 0; i < 4 && sib; i++) {
                    const t = stripChoice(sib.innerText || sib.textContent || '');
                    if (t.length >= 4 && t.length <= 80 && titleHints.some((h) => t.includes(h))) {
                        return t;
                    }
                    sib = sib.previousElementSibling;
                }
                const own = stripChoice(node.innerText || '');
                for (const line of own.split(/\\n+/).map((x) => x.trim()).filter(Boolean)) {
                    if (line.startsWith('※') || line.startsWith('・')) continue;
                    if (line.length >= 4 && line.length <= 40 && titleHints.some((h) => line.includes(h))) {
                        return line;
                    }
                }
                node = node.parentElement;
            }
            return stripChoice(container.innerText || '').slice(0, 60);
        };

        const pairs = [];
        const usedJoin = new Set();
        for (const label of document.querySelectorAll('label')) {
            if (!joinTexts.has(labelText(label))) continue;
            const joinInput = radioFor(label);
            if (!joinInput || joinInput.type !== 'radio' || usedJoin.has(joinInput)) continue;

            let container = label.parentElement;
            let declineLabel = null;
            for (let depth = 0; depth < 10 && container; depth++) {
                const joinLabs = [];
                const declineLabs = [];
                for (const lab of container.querySelectorAll('label')) {
                    const t = labelText(lab);
                    if (joinTexts.has(t)) joinLabs.push(lab);
                    else if (declineTexts.has(t)) declineLabs.push(lab);
                }
                if (joinLabs.length === 1 && declineLabs.length === 1 && joinLabs[0] === label) {
                    declineLabel = declineLabs[0];
                    break;
                }
                container = container.parentElement;
            }
            if (!declineLabel || !container) continue;
            const declineInput = radioFor(declineLabel);
            if (joinInput.disabled && declineInput && declineInput.disabled) continue;
            usedJoin.add(joinInput);
            const sectionRaw = findTitle(container);
            const idx = pairs.length;
            pairs.push({
                index: idx,
                section: sectionRaw.toLowerCase(),
                sectionRaw,
                joinDisabled: !!joinInput.disabled,
            });
            label.setAttribute('data-campaign-join-idx', String(idx));
            declineLabel.setAttribute('data-campaign-decline-idx', String(idx));
            joinInput.setAttribute('data-campaign-join-input-idx', String(idx));
        }
        return pairs;
    }"""

    pairs = page.evaluate(discover_js) or []

    def choose_join(section: str) -> bool:
        if mode == "all":
            return True
        if mode == "none":
            return False
        lower = section.lower()
        return any(k.lower() in lower for k in keywords)

    def sort_key(pair: dict) -> tuple[int, int]:
        section = str(pair.get("section") or "")
        if "超值" in section or "value" in section:
            return (0, int(pair["index"]))
        if "試用" in section or "trial" in section:
            return (2, int(pair["index"]))
        return (1, int(pair["index"]))

    ordered = sorted(pairs, key=sort_key)
    joined = 0
    declined = 0
    matched: list[str] = []

    click_js = """({ index, join }) => {
        const joinLabel = document.querySelector('[data-campaign-join-idx="' + index + '"]');
        const declineLabel = document.querySelector('[data-campaign-decline-idx="' + index + '"]');
        const joinInput = document.querySelector('[data-campaign-join-input-idx="' + index + '"]');
        const targetLabel = join ? joinLabel : declineLabel;
        let targetInput = null;
        if (join) {
            targetInput = joinInput;
        } else if (declineLabel) {
            targetInput = declineLabel.querySelector('input[type="radio"]')
                || document.getElementById(declineLabel.getAttribute('for') || '');
        }
        if (!targetLabel && !targetInput) return { ok: false, reason: 'missing' };
        if (targetInput && targetInput.disabled) return { ok: false, reason: 'disabled' };
        if (targetInput) {
            targetInput.checked = true;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            try { targetInput.click(); } catch (e) {}
        }
        if (targetLabel) {
            try { targetLabel.click(); } catch (e) {}
        }
        return {
            ok: true,
            joinChecked: !!(joinInput && joinInput.checked),
        };
    }"""

    for pair in ordered:
        section = str(pair.get("section") or "")
        want_join = choose_join(section)
        if pair.get("joinDisabled") and want_join:
            print(f"Campaign skip (disabled join): {pair.get('sectionRaw')!r}", flush=True)
            continue

        attempts = 3 if (("試用" in section or "trial" in section) and want_join) else 1
        ok_checked = False
        for attempt in range(attempts):
            page.evaluate(click_js, {"index": pair["index"], "join": want_join})
            page.wait_for_timeout(800)
            if ("超值" in section or "value" in section) and want_join:
                page.wait_for_timeout(1000)
            if want_join:
                ok_checked = bool(
                    page.evaluate(
                        """(index) => {
                            const input = document.querySelector(
                              '[data-campaign-join-input-idx="' + index + '"]'
                            );
                            return !!(input && input.checked);
                        }""",
                        pair["index"],
                    )
                )
                if ok_checked:
                    break
                if attempt + 1 < attempts:
                    for pre in ordered:
                        pre_section = str(pre.get("section") or "")
                        if ("超值" in pre_section or "value" in pre_section) and choose_join(
                            pre_section
                        ):
                            page.evaluate(click_js, {"index": pre["index"], "join": True})
                            page.wait_for_timeout(1100)
            else:
                break

        if want_join:
            joined += 1
            matched.append(str(pair.get("sectionRaw") or ""))
            if ("試用" in section or "trial" in section) and not ok_checked:
                print(
                    f"WARNING: free-trial join did not stick after retries: {pair.get('sectionRaw')!r}",
                    flush=True,
                )
        else:
            declined += 1

    final = page.evaluate(
        """() => {
            const out = [];
            for (const input of document.querySelectorAll('[data-campaign-join-input-idx]')) {
                const idx = input.getAttribute('data-campaign-join-input-idx');
                const joinLabel = document.querySelector('[data-campaign-join-idx="' + idx + '"]');
                let title = '';
                let node = joinLabel;
                for (let i = 0; i < 6 && node; i++) {
                    const prev = node.previousElementSibling;
                    if (prev) {
                        const t = (prev.innerText || '').replace(/\\s+/g, ' ').trim();
                        if (t.length >= 4 && t.length <= 40) { title = t; break; }
                    }
                    node = node.parentElement;
                }
                out.push({ idx, joinChecked: !!input.checked, title: title.slice(0, 40) });
            }
            return out;
        }"""
    )

    print(
        f"Campaigns: joined={joined} declined={declined} groups={len(pairs)} "
        f"(JOIN_CAMPAIGNS={raw!r})",
        flush=True,
    )
    sample = [str(p.get("sectionRaw") or "") for p in pairs[:8]]
    if sample:
        print(f"Campaign sections sample: {sample}", flush=True)
    if matched:
        print(f"Campaign joined titles: {matched}", flush=True)
    if final:
        print(f"Campaign final checked: {final}", flush=True)
    page.wait_for_timeout(400)


'''


def main() -> None:
    path = Path("skills/line-sticker-upload/scripts/provision_line_sticker.py")
    text = path.read_text(encoding="utf-8")
    start = text.index("def configure_campaigns(")
    end = text.index("\ndef dismiss_campaign_float(")
    path.write_text(text[:start] + NEW + text[end:], encoding="utf-8")
    print(f"patched {path} ({end - start} -> {len(NEW)} chars)")


if __name__ == "__main__":
    main()
