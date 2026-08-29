#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/oscp-arsenal"
applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
icons_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
desktop_dir="${desktop_dir:-$HOME/Desktop}"

mkdir -p "$install_dir" "$applications_dir" "$icons_dir" "$desktop_dir"
cp -a "$repo_dir/app/." "$install_dir/"
install -m 0755 "$repo_dir/scripts/open.sh" "$install_dir/open.sh"
install -m 0644 "$repo_dir/app/icon.svg" "$icons_dir/oscp-arsenal.svg"
install -m 0644 "$repo_dir/packaging/oscp-arsenal.desktop" "$applications_dir/oscp-arsenal.desktop"
install -m 0755 "$repo_dir/packaging/oscp-arsenal.desktop" "$desktop_dir/OSCP Arsenal.desktop"

if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi

printf 'Installed: %s\n' "$install_dir"
