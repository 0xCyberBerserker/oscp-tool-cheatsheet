#!/usr/bin/env python3
"""Validate the portable knowledge-path examples without runtime dependencies."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(relative_path: str) -> dict[str, object]:
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def validate_pack(pack: dict[str, object]) -> set[str]:
    assert pack["schemaVersion"] == 1
    assert pack["defaultLanguage"] in pack["languages"]
    card_ids = [card["id"] for card in pack["cards"]]
    assert len(card_ids) == len(set(card_ids))
    assert all({"en", "es"} <= set(card["title"]) for card in pack["cards"])
    assert all({"en", "es"} <= set(card["body"]) for card in pack["cards"])

    for path in pack["paths"]:
        step_ids = [step["id"] for step in path["steps"]]
        assert len(step_ids) == len(set(step_ids))
        assert path["entryStep"] in step_ids
        for step in path["steps"]:
            assert step["cardId"] in card_ids
            assert set(step["next"]) <= set(step_ids)

        reachable = {path["entryStep"]}
        pending = [path["entryStep"]]
        steps_by_id = {step["id"]: step for step in path["steps"]}
        while pending:
            current = pending.pop()
            for next_id in steps_by_id[current]["next"]:
                if next_id not in reachable:
                    reachable.add(next_id)
                    pending.append(next_id)
        assert reachable == set(step_ids), f"{path['id']}: unreachable steps"

    return set(card_ids)


def main() -> int:
    foundations = load("knowledge/packs/oscp-foundations.json")
    interactive = load("knowledge/packs/oscp-interactive.json")
    guides = load("data/guides.json")
    progress = load("knowledge/examples/progress.example.json")
    load("knowledge/schema/knowledge-pack.schema.json")
    load("knowledge/schema/progress.schema.json")

    foundation_ids = validate_pack(foundations)
    interactive_ids = validate_pack(interactive)
    assert len(interactive_ids) == len(foundation_ids) + len(guides)
    assert interactive["id"] == "oscp-interactive"
    assert all(card["visibility"] == "public" for card in interactive["cards"])
    references = [card for card in interactive["cards"] if card["kind"] == "reference"]
    assert all(card["source"]["ref"].startswith("https://") for card in references)
    classic_cards = {"reference.starship", "reference.zellij", "reference.fzf", "reference.zoxide", "reference.eza", "reference.bat"}
    for card in references:
        if card["id"] in classic_cards:
            assert "Classic Linux fallback" in card["body"]["en"]
            assert "Alternativa clásica de Linux" in card["body"]["es"]

    assert progress["schemaVersion"] == 1
    assert progress["packId"] == foundations["id"]
    assert progress["packVersion"] == foundations["version"]
    assert set(progress["pinnedCardIds"]) <= foundation_ids
    assert set(progress["cards"]) <= foundation_ids
    print("knowledge contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
