#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
plugin_dir="${HOME}/homebrew/plugins/decky-audiobookshelf"

if [[ ! -f "${project_dir}/dist/index.js" ]]; then
  echo "dist/index.js is missing. Pull the latest main branch or build the frontend first." >&2
  exit 1
fi

if [[ ! -x "${project_dir}/bin/mpv" ]] && ! command -v mpv >/dev/null 2>&1; then
  echo "Warning: mpv is not installed or bundled. The panel will load, but audio cannot start." >&2
fi

sudo install -d "${plugin_dir}"
sudo rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'out/' \
  --exclude 'tests/' \
  "${project_dir}/" "${plugin_dir}/"

sudo systemctl restart plugin_loader
echo "Installed to ${plugin_dir}. Open … → Decky → Audiobookshelf."
