#!/usr/bin/env python3
"""Withdraw 0909 sets from review, join campaigns, save, re-submit."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BATCH = REPO / ".line-upload" / ".env.batch"
NAMES = [
    "Huahua_Read_Reply_Chaos.env",
    "Huahua_Badminton_Trash_Talk.env",
    "Huahua_Badminton_King.env",
    "Huahua_Brain_Buffering.env",
]
SCRIPTS = REPO / "skills" / "line-sticker-upload" / "scripts"


def main() -> int:
    py = sys.executable
    log_dir = REPO / "output" / "_upload0909-logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    failed = 0
    for name in NAMES:
        env_path = BATCH / name
        print(f"\n===== {name} =====", flush=True)

        # 1) provision/update: withdraw + set campaigns + save
        prov_log = log_dir / f"{name}_join_prov.log"
        prov_cmd = [
            py,
            str(SCRIPTS / "provision_line_sticker.py"),
            "--env",
            str(env_path),
            "--headless",
            "--no-pause-before-save",
        ]
        with prov_log.open("w", encoding="utf-8") as log:
            rc = subprocess.run(prov_cmd, cwd=REPO, stdout=log, stderr=subprocess.STDOUT).returncode
        for line in prov_log.read_text(encoding="utf-8", errors="replace").splitlines():
            if any(
                k in line
                for k in (
                    "Campaigns:",
                    "Withdrew",
                    "LINE_STICKER_ID=",
                    "PROJECT_URL=",
                    "Could not",
                    "Error",
                )
            ):
                print(line.encode("utf-8", errors="replace").decode("utf-8"), flush=True)
        if rc != 0:
            print(f"provision failed exit={rc}", flush=True)
            failed += 1
            continue

        # 2) re-submit for review
        sub_log = log_dir / f"{name}_join_submit.log"
        sub_cmd = [
            py,
            str(SCRIPTS / "submit_line_review.py"),
            "--env",
            str(env_path),
            "--headless",
        ]
        with sub_log.open("w", encoding="utf-8") as log:
            rc2 = subprocess.run(sub_cmd, cwd=REPO, stdout=log, stderr=subprocess.STDOUT).returncode
        for line in sub_log.read_text(encoding="utf-8", errors="replace").splitlines():
            print(line.encode("utf-8", errors="replace").decode("utf-8"), flush=True)
        if rc2 != 0:
            print(f"submit failed exit={rc2}", flush=True)
            failed += 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
