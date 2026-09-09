#!/usr/bin/env python3
"""Fix JOIN_CAMPAIGNS on 0909 batch envs and re-provision campaign choices."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BATCH = REPO / ".line-upload" / ".env.batch"
VAL = "超值,拼貼,免費試用"
NAMES = [
    "Huahua_Read_Reply_Chaos.env",
    "Huahua_Badminton_Trash_Talk.env",
    "Huahua_Badminton_King.env",
    "Huahua_Brain_Buffering.env",
]


def patch_env(path: Path) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    found = False
    for line in lines:
        if line.startswith("JOIN_CAMPAIGNS="):
            out.append(f"JOIN_CAMPAIGNS={VAL}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"JOIN_CAMPAIGNS={VAL}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    joined = next(l for l in path.read_text(encoding="utf-8").splitlines() if l.startswith("JOIN_CAMPAIGNS="))
    print(f"{path.name}: {joined}")


def main() -> int:
    for name in NAMES:
        patch_env(BATCH / name)

    py = sys.executable
    script = REPO / "skills" / "line-sticker-upload" / "scripts" / "provision_line_sticker.py"
    log_dir = REPO / "output" / "_upload0909-logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    failed = 0
    for name in NAMES:
        env_path = BATCH / name
        log_path = log_dir / f"{name}_campaign_join2.log"
        cmd = [
            py,
            str(script),
            "--env",
            str(env_path),
            "--headless",
            "--no-pause-before-save",
        ]
        print(f"\n=== {name} ===", flush=True)
        with log_path.open("w", encoding="utf-8") as log:
            result = subprocess.run(cmd, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
        text = log_path.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            if any(k in line for k in ("Campaigns:", "LINE_STICKER_ID=", "PROJECT_URL=", "Could not", "Error", "FAILED")):
                print(line, flush=True)
        if result.returncode != 0:
            failed += 1
            print(f"exit={result.returncode}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
