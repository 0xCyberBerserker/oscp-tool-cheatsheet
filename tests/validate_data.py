#!/usr/bin/env python3
"""Enforce the complete per-tool cheatsheet contract."""

from __future__ import annotations

import json
import pathlib
import re


ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_payload() -> dict[str, object]:
    text = (ROOT / "app" / "data.js").read_text(encoding="utf-8")
    prefix = "window.OSCP_DATA = "
    assert text.startswith(prefix) and text.endswith(";\n")
    return json.loads(text[len(prefix):-2])


def main() -> int:
    data = load_payload()
    tools = data["tools"]
    assert data["toolCount"] == 201
    assert data["completeCount"] == data["toolCount"]
    assert data["recipeCount"] == data["toolCount"]
    assert len({tool["name"].casefold() for tool in tools}) == len(tools)

    for tool in tools:
        label = tool["name"]
        assert tool["descriptionEn"].strip(), f"{label}: missing English purpose"
        assert tool["descriptionEs"].strip(), f"{label}: missing Spanish purpose"
        assert tool["syntax"].strip(), f"{label}: missing syntax"
        assert tool["options"], f"{label}: missing options or workflow controls"
        assert tool["recipes"], f"{label}: missing operational recipe"
        assert tool["sourceType"].strip(), f"{label}: missing source type"
        assert tool["sourceRef"].strip(), f"{label}: missing source reference"
        for recipe in tool["recipes"]:
            assert len(recipe) == 3 and all(str(value).strip() for value in recipe), f"{label}: invalid recipe"
            assert not re.search(r"(?:^|\s)(?:--help|-h|-help)\s*$", recipe[2]), f"{label}: help-only recipe"
        for option in tool["options"]:
            assert len(option) == 3 and all(str(value).strip() for value in option), f"{label}: invalid option"

    print("data contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
