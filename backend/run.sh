#!/usr/bin/env bash
# Dev run script. Uses uv to resolve deps from pyproject.toml.
set -euo pipefail
cd "$(dirname "$0")"
export PYTHONPATH="$(cd .. && pwd):${PYTHONPATH:-}"
exec uv run --with 'fastapi>=0.115' --with 'uvicorn[standard]>=0.32' \
  --with 'aiohttp>=3.10' --with 'eth-abi>=5.1' --with 'eth-utils>=5.1' \
  --with 'eth-hash[pycryptodome]>=0.7' --with 'pydantic>=2.9' \
  --with 'pydantic-settings>=2.5' \
  uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
