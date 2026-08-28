#!/usr/bin/env python3
"""Merge the Kali inventory and repository-maintained guidance."""

from __future__ import annotations

import json
import pathlib
import re


ROOT = pathlib.Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "kali-tools.json"
GUIDES = ROOT / "data" / "guides.json"
OUTPUT = ROOT / "app" / "data.js"

PHASES = [
    {"id": "recon", "en": "Reconnaissance", "es": "Reconocimiento"},
    {"id": "enumeration", "en": "Enumeration", "es": "Enumeración"},
    {"id": "assessment", "en": "Assessment", "es": "Análisis"},
    {"id": "web", "en": "Web", "es": "Web"},
    {"id": "credential-access", "en": "Credentials", "es": "Credenciales"},
    {"id": "exploitation", "en": "Exploitation", "es": "Explotación"},
    {"id": "post-exploitation", "en": "Post-exploitation", "es": "Post-explotación"},
    {"id": "privilege-escalation", "en": "Privilege escalation", "es": "Escalada de privilegios"},
    {"id": "active-directory", "en": "Active Directory", "es": "Active Directory"},
    {"id": "lateral-movement", "en": "Lateral movement", "es": "Movimiento lateral"},
    {"id": "pivoting", "en": "Pivoting and tunnels", "es": "Pivoting y túneles"},
    {"id": "file-transfer", "en": "File transfer", "es": "Transferencia"},
    {"id": "forensics", "en": "Forensics", "es": "Forense"},
    {"id": "wireless", "en": "Wireless", "es": "Wireless"},
    {"id": "reporting", "en": "Reporting", "es": "Reporting"},
    {"id": "resource-development", "en": "Payload resources", "es": "Recursos y payloads"},
    {"id": "workflow", "en": "Workflow", "es": "Flujo de trabajo"},
    {"id": "support", "en": "Support", "es": "Soporte"},
]

RULES = {
    "recon": ("reconnaissance", "network-information", "identify", "discovery"),
    "enumeration": ("enumeration", "network-service-discovery", "remote-system-discovery", "network-share-discovery"),
    "assessment": ("vulnerability", "web-scanning"),
    "web": ("web", "application-layer-protocol"),
    "credential-access": ("credential", "password", "brute-force", "pass-the-hash", "os-credential-dumping"),
    "exploitation": ("initial-access", "execution"),
    "post-exploitation": ("post-exploitation", "persistence", "command-and-control", "collection", "exfiltration"),
    "privilege-escalation": ("privilege-escalation",),
    "active-directory": ("active-directory", "domain-trust-discovery"),
    "lateral-movement": ("lateral-movement", "system-services"),
    "pivoting": ("protocol-tunneling", "non-application-layer-protocol"),
    "forensics": ("forensic", "sleuth-kit-suite"),
    "wireless": ("wifi", "wireless"),
    "reporting": ("reporting",),
    "resource-development": ("resource-development",),
}

SYNTAX_OVERRIDES = {
    "atk6-thcping6": "atk6-thcping6 [options] INTERFACE TARGET",
}


def infer_phases(categories: list[str]) -> list[str]:
    joined = " ".join(categories)
    phases = [phase for phase, needles in RULES.items() if any(needle in joined for needle in needles)]
    return phases or ["support"]


def clean_syntax(lines: list[str], fallback: str) -> str:
    syntax = " ".join(lines[:2]) if lines else fallback
    syntax = re.sub(r"\s+", " ", syntax).strip()
    syntax = re.sub(r"\s+(?:--help|-h|-help)$", "", syntax).strip()
    return syntax or fallback


def fallback_command(item: dict[str, object]) -> str:
    command = re.sub(r"\s+(?:--help|-h|-help)$", "", str(item["command"])).strip()
    return command or str(item["name"])


def option_records(options: list[str], syntax: str) -> list[list[str]]:
    values = [
        value for value in options
        if not re.match(r"^(?:-h,?\s+--help|--help|-h\s|--version)", value)
    ][:8]
    if not values:
        values = list(dict.fromkeys(re.findall(r"(?<!\w)-{1,2}[A-Za-z0-9][\w-]*", syntax)))[:8]
    if not values:
        return [["GUI / interactive", "Interactive workflow control", "Control de flujo interactivo"]]
    records = []
    for value in values:
        match = re.match(
            r"((?:-{1,2}[\w?][\w?-]*(?:\s+<[^>]+>)?)(?:,\s+--?[\w-]+(?:\s+<[^>]+>)?)?)(?:\s+(.*))?",
            value,
        )
        flag = match.group(1) if match else value
        description = match.group(2) if match and match.group(2) else "See the installed documentation context."
        description_es = (
            f"Documentación instalada: {description}"
            if description != "See the installed documentation context."
            else "Consulte el contexto de la documentación instalada."
        )
        records.append([flag, description, description_es])
    return records


def spanish_summary(item: dict[str, object], phases: list[str]) -> str:
    phase = next((entry["es"] for entry in PHASES if entry["id"] == phases[0]), "soporte")
    return f"Herramienta de {phase.lower()} del paquete {item['package']}: {item['description']}"


def main() -> int:
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    guides = json.loads(GUIDES.read_text(encoding="utf-8"))
    guide_by_name = {guide["name"].casefold(): guide for guide in guides}
    tools: list[dict[str, object]] = []
    seen: set[str] = set()

    for item in inventory:
        if item["package"] == "kali-menu":
            continue
        key = item["name"].casefold()
        guide = guide_by_name.get(key, {})
        phases = guide.get("phases") or infer_phases(item["categories"])
        syntax = SYNTAX_OVERRIDES.get(item["name"], fallback_command(item))
        recipes = guide.get("recipes") or [["Open tool", "Abrir herramienta", syntax]]
        options = option_records([], syntax)
        source_type = "maintained-guide" if guide else "kali-inventory"
        tools.append(
            {
                "name": item["name"],
                "package": item["package"],
                "descriptionEn": guide.get("summaryEn") or f"Tool from the {item['package']} Kali package.",
                "descriptionEs": guide.get("summaryEs") or spanish_summary(item, phases),
                "aliases": guide.get("aliases", []) + item["categories"],
                "phases": phases,
                "syntax": syntax,
                "options": options,
                "recipes": recipes,
                "sourceType": source_type,
                "sourceRef": "Repository-maintained guide" if guide else item["package"],
                "officialUrl": guide.get("sourceUrl") or f"https://www.kali.org/tools/{item['package']}/",
                "sourceVerified": bool(guide),
                "complete": bool(syntax and options and recipes),
                "curated": bool(guide),
            }
        )
        seen.add(key)

    for guide in guides:
        key = guide["name"].casefold()
        if key in seen:
            continue
        tools.append(
            {
                "name": guide["name"],
                "package": guide["name"],
                "descriptionEn": guide["summaryEn"],
                "descriptionEs": guide["summaryEs"],
                "aliases": guide["aliases"],
                "phases": guide["phases"],
                "syntax": guide["recipes"][0][2],
                "options": option_records([], guide["recipes"][0][2]),
                "recipes": guide["recipes"],
                "sourceType": "maintained-guide",
                "sourceRef": "Repository-maintained guide",
                "officialUrl": guide.get("sourceUrl", ""),
                "sourceVerified": True,
                "complete": True,
                "curated": True,
            }
        )

    tools.sort(key=lambda tool: str(tool["name"]).casefold())
    payload = {
        "generatedFrom": "Kali live inventory",
        "inventoryCount": len(inventory),
        "toolCount": len(tools),
        "recipeCount": sum(bool(tool["recipes"]) for tool in tools),
        "completeCount": sum(bool(tool["complete"]) for tool in tools),
        "sourceVerifiedCount": sum(bool(tool["sourceVerified"]) for tool in tools),
        "curatedCount": sum(bool(tool["curated"]) for tool in tools),
        "phases": PHASES,
        "tools": tools,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "window.OSCP_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
