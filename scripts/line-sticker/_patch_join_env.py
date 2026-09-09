#!/usr/bin/env python3
from pathlib import Path
import re

src = Path("scripts/line-sticker/_fix_campaigns_0909.py").read_text(encoding="utf-8")
val = re.search(r'VAL = "(.+?)"', src).group(1)
print("VAL=", val)
print("bytes=", val.encode("utf-8"))
for name in [
    "Huahua_Read_Reply_Chaos.env",
    "Huahua_Badminton_Trash_Talk.env",
    "Huahua_Badminton_King.env",
    "Huahua_Brain_Buffering.env",
]:
    p = Path(".line-upload/.env.batch") / name
    lines = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("JOIN_CAMPAIGNS="):
            lines.append("JOIN_CAMPAIGNS=" + val)
        else:
            lines.append(line)
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(name, next(l for l in p.read_text(encoding="utf-8").splitlines() if l.startswith("JOIN")))
