#!/usr/bin/env bash
# Renders the app icons in public/ from the SVGs here, with headless Chrome. Run it after
# changing an SVG and commit the PNGs: the build does not render icons.
set -euo pipefail
cd "$(dirname "$0")/../.."
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

render() { # svg, size, png
  printf '<html><body style="margin:0"><img src="file://%s" width="%s" height="%s"></body></html>' \
    "$PWD/$1" "$2" "$2" > "$tmp/page.html"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$2,$2" --screenshot="$PWD/$3" "file://$tmp/page.html" > /dev/null 2>&1
}

mkdir -p public/icons
cp build/icons/icon.svg public/favicon.svg
render build/icons/icon.svg 192 public/icons/icon-192.png
render build/icons/icon.svg 512 public/icons/icon-512.png
render build/icons/icon-maskable.svg 512 public/icons/icon-maskable-512.png
render build/icons/icon-maskable.svg 180 public/icons/apple-touch-icon.png
