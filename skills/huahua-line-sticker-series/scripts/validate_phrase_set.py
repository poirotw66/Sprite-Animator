#!/usr/bin/env python3
"""Validate Huahua phrase-set JSON files without third-party dependencies."""

import argparse
import json
import sys
from pathlib import Path


def unique_object(pairs):
    """Reject duplicate JSON keys instead of silently retaining the last value."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def validate(payload, expected_count):
    """Return structural errors for one phrase-set object."""
    if not isinstance(payload, dict):
        return ["Top-level JSON must be an object."]
    errors = []
    required = {"format", "version", "mode", "phrases", "actionDescs"}
    if set(payload) != required:
        errors.append("Fields must be exactly: format, version, mode, phrases, actionDescs.")
    if payload.get("format") != "line-sticker-phrase-set":
        errors.append("format must be line-sticker-phrase-set.")
    if type(payload.get("version")) is not int or payload["version"] != 1:
        errors.append("version must be integer 1.")
    if payload.get("mode") != "set":
        errors.append("mode must be set.")
    for key in ("phrases", "actionDescs"):
        values = payload.get(key)
        if not isinstance(values, list):
            errors.append(f"{key} must be an array.")
            continue
        if len(values) != expected_count:
            errors.append(f"{key} has {len(values)} items; expected {expected_count}.")
        for index, value in enumerate(values, start=1):
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{key} item {index} must be a nonempty string.")
    phrases = payload.get("phrases")
    actions = payload.get("actionDescs")
    if isinstance(phrases, list) and isinstance(actions, list) and len(phrases) != len(actions):
        errors.append("phrases and actionDescs lengths must match.")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--expected-count", type=int, default=20)
    args = parser.parse_args()
    if args.expected_count < 1:
        parser.error("--expected-count must be positive")
    errors = []
    seen = {}
    for path in args.files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
        except (OSError, UnicodeError, ValueError) as error:
            errors.append(f"{path}: {error}")
            continue
        errors.extend(f"{path}: {error}" for error in validate(payload, args.expected_count))
        if isinstance(payload, dict) and isinstance(payload.get("phrases"), list):
            for index, phrase in enumerate(payload["phrases"], start=1):
                if not isinstance(phrase, str) or not phrase.strip():
                    continue
                normalized = phrase.strip()
                location = f"{path}: phrase {index}"
                if normalized in seen:
                    errors.append(f"{location}: Duplicate phrase; first seen at {seen[normalized]}.")
                else:
                    seen[normalized] = location
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Validated {len(args.files)} group(s), {args.expected_count} items per group.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
