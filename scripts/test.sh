#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

python3 scripts/build_data.py
python3 scripts/build_knowledge.py
python3 -m py_compile scripts/inventory_kali.py scripts/build_data.py scripts/build_knowledge.py tests/validate_html.py tests/validate_data.py tests/validate_knowledge.py
python3 tests/validate_html.py
python3 tests/validate_data.py
python3 tests/validate_knowledge.py
node tests/search.test.js
node tests/knowledge-ui.test.js
node tests/profile-crypto.test.js
node tests/profile-store.test.js
node tests/worker-policy.test.mjs
jq empty data/kali-tools.json data/guides.json
jq -e 'all(.[]; (.command | type == "string" and length > 0))' data/kali-tools.json >/dev/null

echo "all checks: OK"
