#!/usr/bin/env python3
"""Export installed Kali menu tools as deterministic JSON."""

from __future__ import annotations

import configparser
import json
import pathlib
import shlex
import subprocess
import sys


MENU_DIR = pathlib.Path("/usr/share/kali-menu/applications")


def installed_packages() -> set[str]:
    output = subprocess.run(
        ["dpkg-query", "-W", "-f=${binary:Package}\t${db:Status-Abbrev}\n"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return {
        package.split(":", 1)[0]
        for package, status in (line.split("\t", 1) for line in output.splitlines())
        if status.startswith("ii")
    }


def launcher_command(value: str) -> str:
    try:
        arguments = shlex.split(value)
    except ValueError:
        return ""
    if arguments and arguments[0] == "/usr/share/kali-menu/exec-in-shell":
        return arguments[1] if len(arguments) > 1 else ""
    return shlex.join(argument for argument in arguments if not argument.startswith("%"))


def main() -> int:
    installed = installed_packages()
    tools: list[dict[str, object]] = []

    for path in sorted(MENU_DIR.glob("kali-*.desktop")):
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        parser.optionxform = str
        try:
            parser.read(path, encoding="utf-8")
            entry = parser["Desktop Entry"]
        except (configparser.Error, KeyError):
            continue

        package = entry.get("X-Kali-Package", "").strip()
        if not package or package not in installed:
            continue

        categories = sorted(
            category.removeprefix("kali-")
            for category in entry.get("Categories", "").split(";")
            if category.startswith("kali-")
        )
        tools.append(
            {
                "name": entry.get("Name", package).strip(),
                "package": package,
                "description": entry.get("Comment", "").strip(),
                "categories": categories,
                "command": launcher_command(entry.get("Exec", "")),
                "launcher": path.name,
            }
        )

    payload = json.dumps(tools, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if len(sys.argv) == 2:
        pathlib.Path(sys.argv[1]).write_text(payload, encoding="utf-8")
    else:
        sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
