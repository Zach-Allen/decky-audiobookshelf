#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-/backend/out/mpv}"
build_dir="$(mktemp -d)"
trap 'rm -rf "${build_dir}"' EXIT

git clone https://github.com/mpv-player/mpv-build.git "${build_dir}/mpv-build"
cd "${build_dir}/mpv-build"
git checkout 9443097290e82008f26f1597590926c63e7ae053

mkdir -p config
printf '%s\n' '@e48ac7ce08462f5e33af6ef9deeac6fa87eef01e' > config/branch-mpv
printf '%s\n' '@db69d06eeeab4f46da15030a80d539efb4503ca8' > config/branch-ffmpeg
# mpv-build currently prepares these helper libraries before applying mpv's
# feature switches. They are not linked into the final audio-only executable.
printf '%s\n' '@e46aedea0a0d17da4c4ef49d84b94a7994664ab5' > config/branch-libass
printf '%s\n' '@1fd3c7bde7b943fe8985c893310b5269a09b46c5' > config/branch-libplacebo

cat > mpv_options <<'EOF'
-Dauto_features=disabled
-Dalsa=enabled
-Dbuild-date=false
-Dgl=disabled
-Dlibass=disabled
-Dlibmpv=false
-Dlibplacebo=disabled
-Dpipewire=disabled
-Dpulse=enabled
EOF

./update --skip-selfupdate
./build -j"$(nproc)"

mkdir -p "$(dirname "${output_path}")"
install -m 0755 mpv/build/mpv "${output_path}"
echo "Built ${output_path} against the SteamOS/Holo runtime"
