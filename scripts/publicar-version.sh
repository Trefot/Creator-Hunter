#!/usr/bin/env bash
# Compila en Windows y publica el canal compatible con la app instalada (D-028).
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(node -p 'process.platform')" = win32 ] || { echo 'Este script necesita Windows; para compilar remotamente usa el workflow Publicar actualización de Windows.'; exit 1; }
npm run release:check
npm test
cargo test --locked --manifest-path tests/data-safety/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
npm run release:prepare
VERSION=$(node -p "require('./.release/latest.json').version")
REMOTE=$(git remote get-url origin)
AUTHOR_NAME=$(git log -1 --format=%an)
AUTHOR_EMAIL=$(git log -1 --format=%ae)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
git clone --quiet --depth 1 --branch releases "$REMOTE" "$WORK/channel"
node scripts/release.mjs check-channel "$WORK/channel/latest.json"
cp .release/latest.json .release/TrophyHunter-setup.exe "$WORK/channel/"
git -C "$WORK/channel" add latest.json TrophyHunter-setup.exe
if ! git -C "$WORK/channel" diff --cached --quiet; then
  git -C "$WORK/channel" -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" commit -q -m "Nexus Studio $VERSION"
  git -C "$WORK/channel" push origin HEAD:releases
fi
DEST="$HOME/OneDrive/Documents/TrophyHunter/Instaladores"
[ -d "$DEST" ] || DEST="$HOME/Documents/TrophyHunter/Instaladores"
mkdir -p "$DEST"
cp .release/TrophyHunter-setup.exe "$DEST/TrophyHunter_${VERSION}_x64-setup.exe"
echo "Nexus Studio $VERSION publicado; instalador compatible guardado en $DEST."
