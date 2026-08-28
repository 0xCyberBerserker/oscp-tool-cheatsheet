#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${OSCP_NATIVE_BUILD_DIR:-$repo_dir/build/native}"

python3 "$repo_dir/scripts/build_knowledge.py"
cmake -S "$repo_dir/native" -B "$build_dir" -DCMAKE_BUILD_TYPE=Release
cmake --build "$build_dir" --parallel
QT_QPA_PLATFORM=offscreen "$build_dir/oscp-knowledge-paths" --smoke-test

printf 'native checks: OK\n'
