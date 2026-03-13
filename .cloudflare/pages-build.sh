#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/assets"

cp "$ROOT_DIR/index.html" "$DIST_DIR/"
cp "$ROOT_DIR/main.js" "$DIST_DIR/"
cp "$ROOT_DIR/style.css" "$DIST_DIR/"
cp "$ROOT_DIR/supabase-config.js" "$DIST_DIR/"
cp "$ROOT_DIR/_headers" "$DIST_DIR/"
cp -R "$ROOT_DIR/assets/." "$DIST_DIR/assets/"
