#!/usr/bin/env bash
# Publica la versión actual para que la app instalada se actualice sola (D-023), como Lumen.
#
#   bash scripts/publicar-version.sh
#
# 1. Compila el instalador (npm run tauri build) con la versión de package.json.
# 2. Saca las novedades de esa versión del CHANGELOG.md (las líneas "- " de su sección).
# 3. Sube a la rama `releases` de GitHub un solo commit con latest.json + el instalador
#    (se reemplaza en cada versión, así el repositorio no crece).
# 4. Copia el instalador a Documentos\TrophyHunter\Instaladores (plan B si GitHub falla).
#
# Antes: subir la versión en package.json, tauri.conf.json, Cargo.toml y es.version, y escribir
# su sección "## [X.Y.Z] · fecha · título" en CHANGELOG.md.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
SETUP="src-tauri/target/release/bundle/nsis/TrophyHunter_${VERSION}_x64-setup.exe"
REMOTE=$(git remote get-url origin)
AUTHOR_NAME=$(git log -1 --format=%an)
AUTHOR_EMAIL=$(git log -1 --format=%ae)

grep -q "\"version\": \"$VERSION\"" src-tauri/tauri.conf.json || { echo "tauri.conf.json no tiene la versión $VERSION"; exit 1; }
grep -q "## \[$VERSION\]" CHANGELOG.md || { echo "CHANGELOG.md no tiene la sección [$VERSION]"; exit 1; }

echo "== Compilando $VERSION"
npm run tauri build > /dev/null
[ -f "$SETUP" ] || { echo "No se generó $SETUP"; exit 1; }

WORK=$(mktemp -d)
cp "$SETUP" "$WORK/TrophyHunter-setup.exe"
node -e '
  const fs = require("fs");
  const [version, out] = process.argv.slice(1);
  const text = fs.readFileSync("CHANGELOG.md", "utf8");
  const start = text.indexOf(`## [${version}]`);
  const rest = text.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  const notes = rest.slice(0, end < 0 ? undefined : end).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
  fs.writeFileSync(out, JSON.stringify({ version, date: new Date().toISOString().slice(0, 10), notes, installer: "TrophyHunter-setup.exe" }, null, 2) + "\n");
  console.log(`Novedades: ${notes.length}`);
' "$VERSION" "$WORK/latest.json"

echo "== Subiendo a la rama releases"
(
  cd "$WORK"
  git init -q
  git add latest.json TrophyHunter-setup.exe
  git -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" commit -q -m "TrophyHunter $VERSION"
  git push -q --force "$REMOTE" HEAD:refs/heads/releases
)
rm -rf "$WORK"

DEST="$HOME/OneDrive/Documents/TrophyHunter/Instaladores"
[ -d "$DEST" ] || DEST="$HOME/Documents/TrophyHunter/Instaladores"
mkdir -p "$DEST" && cp "$SETUP" "$DEST/"

echo "== Listo: TrophyHunter $VERSION publicado (GitHub + $DEST)"
