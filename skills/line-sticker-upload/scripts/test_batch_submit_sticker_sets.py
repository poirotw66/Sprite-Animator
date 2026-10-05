from pathlib import Path

import pytest

import batch_submit_sticker_sets as batch


@pytest.mark.parametrize(
    ("flags", "expected"), [([], False), (["--submit"], True), (["--skip-submit"], False)]
)
def test_submission_requires_opt_in(flags: list[str], expected: bool) -> None:
    assert batch.parse_args(["fixture-input", *flags]).submit is expected


def test_conflicting_submission_flags_are_rejected() -> None:
    with pytest.raises(SystemExit) as error:
        batch.parse_args(["fixture-input", "--submit", "--skip-submit"])
    assert error.value.code == 2


@pytest.mark.parametrize(
    ("submit", "upload_ok", "expected_submit"),
    [(False, True, False), (True, True, True), (True, False, False)],
)
def test_worker_only_submits_when_authorized_and_upload_succeeds(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
    submit: bool, upload_ok: bool, expected_submit: bool,
) -> None:
    set_dir = tmp_path / "set"
    set_dir.mkdir()
    (set_dir / "set.md").write_text("fixture", encoding="utf-8")
    (set_dir / "set.zip").write_bytes(b"fixture")
    env_path = tmp_path / "batch.env"
    env_path.write_text("LINE_CREATOR_ID=fixture\nLINE_STICKER_ID=123\n", encoding="utf-8")
    monkeypatch.setattr(batch, "STATE_DIR", tmp_path / "state")
    monkeypatch.setattr(batch, "MASTER_STORAGE", tmp_path / "missing.json")
    monkeypatch.setattr(batch, "prepare_set_env", lambda *args: env_path)
    monkeypatch.setattr(batch, "parse_sticker_md", lambda *args: {})
    monkeypatch.setattr(batch, "normalize_sticker_meta", lambda *args: {})
    steps: list[str] = []

    def fake_step(name: str, cmd: list[str], **kwargs: object) -> bool:
        steps.append(name)
        assert kwargs["env"]["PYTHONDONTWRITEBYTECODE"] == "1"
        return upload_ok if name == "ZIP upload" else True

    monkeypatch.setattr(batch, "run_step", fake_step)
    job = batch.SetJob(
        set_dir=str(set_dir), credentials_env=str(tmp_path / "credentials.env"),
        batch_env_dir=str(tmp_path), worker_id=1, skip_drive=True,
        skip_provision=True, skip_zip=False, headless_provision=True,
        no_pause_provision=True, continue_on_error=True, submit=submit,
    )
    _, url, ok = batch.process_one_set(job)
    assert ("Submit review" in steps) is expected_submit
    assert (url is not None) is expected_submit
    assert ok is upload_ok
