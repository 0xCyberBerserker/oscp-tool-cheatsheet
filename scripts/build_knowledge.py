#!/usr/bin/env python3
"""Build the public interactive pack from reviewed repository guides."""

from __future__ import annotations

import json
import pathlib
import re

from build_data import PHASES


ROOT = pathlib.Path(__file__).resolve().parents[1]
FOUNDATIONS = ROOT / "knowledge" / "packs" / "oscp-foundations.json"
GUIDES = ROOT / "data" / "guides.json"
OUTPUT = ROOT / "knowledge" / "packs" / "oscp-interactive.json"
WEB_OUTPUT = ROOT / "app" / "knowledge.js"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")


def card_body(guide: dict[str, object], language: str) -> str:
    label_index = 0 if language == "en" else 1
    heading = "Reviewed recipes" if language == "en" else "Recetas revisadas"
    sections = [f"## {heading}"]
    for recipe in guide["recipes"]:
        sections.append(f"### {recipe[label_index]}\n\n```text\n{recipe[2]}\n```")
    return "\n\n".join(sections)


def main() -> int:
    pack = json.loads(FOUNDATIONS.read_text(encoding="utf-8"))
    guides = json.loads(GUIDES.read_text(encoding="utf-8"))
    phase_labels = {phase["id"]: phase for phase in PHASES}

    pack["id"] = "oscp-interactive"
    pack["version"] = "0.2.0"
    pack["title"] = {
        "en": "OSCP Interactive Reference",
        "es": "Referencia interactiva OSCP",
    }

    cards_by_phase: dict[str, list[str]] = {}
    for guide in sorted(guides, key=lambda item: item["name"].casefold()):
        card_id = f"reference.{slug(guide['name'])}"
        pack["cards"].append(
            {
                "id": card_id,
                "kind": "reference",
                "title": {"en": guide["name"], "es": guide["name"]},
                "summary": {"en": guide["summaryEn"], "es": guide["summaryEs"]},
                "body": {
                    "en": card_body(guide, "en"),
                    "es": card_body(guide, "es"),
                },
                "tags": sorted(set(guide["phases"] + ["tool-reference"])),
                "source": {"kind": "curated", "ref": f"data/guides.json:{guide['name']}"},
                "visibility": "public",
            }
        )
        for phase in guide["phases"]:
            cards_by_phase.setdefault(phase, []).append(card_id)

    for phase in PHASES:
        phase_id = phase["id"]
        card_ids = cards_by_phase.get(phase_id, [])
        if not card_ids:
            continue
        steps = []
        for index, card_id in enumerate(card_ids):
            step_id = f"tool-{card_id.removeprefix('reference.')}"
            next_steps = []
            if index + 1 < len(card_ids):
                next_steps = [f"tool-{card_ids[index + 1].removeprefix('reference.')}"]
            steps.append({"id": step_id, "cardId": card_id, "next": next_steps})
        labels = phase_labels[phase_id]
        pack["paths"].append(
            {
                "id": f"references.{phase_id}",
                "title": {"en": labels["en"], "es": labels["es"]},
                "description": {
                    "en": "Reviewed offline tool references for this assessment phase.",
                    "es": "Referencias offline revisadas para esta fase de auditoría.",
                },
                "entryStep": steps[0]["id"],
                "steps": steps,
            }
        )

    OUTPUT.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    WEB_OUTPUT.write_text(
        "window.OSCP_KNOWLEDGE = "
        + json.dumps(pack, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
