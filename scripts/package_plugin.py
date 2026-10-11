"""Create a Decky-compatible release zip from the verified build output."""

from __future__ import annotations

import json
import os
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_NAME = "decky-audiobookshelf"


def iter_payload_files():
    required = [
        ROOT / "dist" / "index.js",
        ROOT / "main.py",
        ROOT / "package.json",
        ROOT / "plugin.json",
        ROOT / "LICENSE",
        ROOT / "THIRD_PARTY_NOTICES.md",
        ROOT / "README.md",
    ]
    for path in required:
        if not path.is_file():
            raise SystemExit(f"Required release file is missing: {path.relative_to(ROOT)}")
        yield path

    yield from sorted((ROOT / "py_modules" / "abs_player_core").glob("*.py"))

    bundled_player = ROOT / "bin" / "mpv"
    if bundled_player.is_file():
        if not os.access(bundled_player, os.X_OK):
            raise SystemExit("bin/mpv exists but is not executable")
        yield bundled_player
    else:
        print("Warning: bin/mpv is not bundled; the Deck must provide mpv on PATH.")


def main():
    metadata = json.loads((ROOT / "package.json").read_text())
    version = metadata["version"]
    output_dir = ROOT / "out"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{PACKAGE_NAME}-{version}.zip"

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in iter_payload_files():
            relative = source.relative_to(ROOT)
            destination = Path(PACKAGE_NAME) / relative
            info = zipfile.ZipInfo.from_file(source, str(destination))
            if relative == Path("bin/mpv"):
                info.external_attr = (stat.S_IFREG | 0o755) << 16
            with source.open("rb") as handle:
                archive.writestr(info, handle.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    print(output_path)


if __name__ == "__main__":
    main()
