#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${OSCP_NATIVE_BUILD_DIR:-$repo_dir/build/native}"
bin_dir="${HOME}/.local/bin"
applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
icons_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
desktop_dir="${desktop_dir:-$HOME/Desktop}"

"$repo_dir/scripts/test-native.sh"

mkdir -p "$bin_dir" "$applications_dir" "$icons_dir" "$desktop_dir"
install -m 0755 "$build_dir/oscp-knowledge-paths" "$bin_dir/oscp-knowledge-paths"
install -m 0644 "$repo_dir/app/icon.svg" "$icons_dir/oscp-arsenal.svg"
install -m 0644 "$repo_dir/packaging/oscp-knowledge-paths.desktop" \
    "$applications_dir/oscp-knowledge-paths.desktop"
install -m 0755 "$repo_dir/packaging/oscp-knowledge-paths.desktop" \
    "$desktop_dir/OSCP Knowledge Paths.desktop"

if command -v update-desktop-database >/dev/null; then
    update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi

printf 'Installed native client: %s\n' "$bin_dir/oscp-knowledge-paths"
