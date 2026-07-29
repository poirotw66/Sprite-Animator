from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import provision_line_sticker  # pylint: disable=no-name-in-module


class FakeBrowser:
    def __init__(self) -> None:
        self.kwargs: dict[str, object] | None = None

    def new_context(self, **kwargs: object) -> object:
        self.kwargs = kwargs
        return object()


def test_create_browser_context_omits_storage_state_when_session_missing(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    missing_storage = tmp_path / "playwright_line_state.json"

    provision_line_sticker.create_browser_context(  # pylint: disable=no-member
        browser, missing_storage
    )

    assert browser.kwargs == {
        "locale": "zh-TW",
        "viewport": {"width": 1400, "height": 900},
    }


def test_create_browser_context_reuses_storage_state_when_session_exists(
    tmp_path: Path,
) -> None:
    browser = FakeBrowser()
    storage = tmp_path / "playwright_line_state.json"
    storage.write_text("{}", encoding="utf-8")

    provision_line_sticker.create_browser_context(  # pylint: disable=no-member
        browser, storage
    )

    assert browser.kwargs == {
        "storage_state": str(storage),
        "locale": "zh-TW",
        "viewport": {"width": 1400, "height": 900},
    }
