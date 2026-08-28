#!/usr/bin/env python3
"""Perform dependency-free structural checks on the static UI."""

from __future__ import annotations

from html.parser import HTMLParser
import json
import pathlib


ROOT = pathlib.Path(__file__).resolve().parents[1]


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self.manifests: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            assert values["id"] not in self.ids, f"duplicate id: {values['id']}"
            self.ids.add(values["id"] or "")
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        if tag == "link" and values.get("rel") == "stylesheet":
            self.stylesheets.append(values.get("href") or "")
        if tag == "link" and values.get("rel") == "manifest":
            self.manifests.append(values.get("href") or "")


def main() -> int:
    app_dir = ROOT / "app"
    parser = DocumentParser()
    parser.feed((app_dir / "index.html").read_text(encoding="utf-8"))
    required_ids = {
        "search", "phase-list", "results", "result-count", "language-toggle", "readable-toggle",
        "tools-mode", "paths-mode", "paths-view", "path-list", "path-body", "local-note",
    }
    assert required_ids <= parser.ids, f"missing ids: {required_ids - parser.ids}"
    for asset in parser.scripts + parser.stylesheets:
        assert (app_dir / asset).is_file(), f"missing asset: {asset}"
    assert not any(asset.startswith(("http://", "https://")) for asset in parser.scripts + parser.stylesheets)
    assert parser.manifests == ["app.webmanifest"], "missing or duplicate web manifest"
    manifest = json.loads((app_dir / parser.manifests[0]).read_text(encoding="utf-8"))
    assert manifest["display"] == "standalone"
    for icon in manifest["icons"]:
        assert (app_dir / icon["src"]).is_file(), f"missing manifest icon: {icon['src']}"
    assert (app_dir / "service-worker.js").is_file(), "missing service worker"
    print("html checks: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
