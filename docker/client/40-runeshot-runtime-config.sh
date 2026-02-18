#!/bin/sh
set -eu

OUT_FILE="/usr/share/nginx/html/runtime-config.js"
VALUE="${RUNESHOT_SERVER_URL:-}"
ESCAPED_VALUE="$(printf '%s' "$VALUE" | sed -e 's/\\/\\\\/g' -e 's/\"/\\"/g')"

printf 'window.__RUNESHOT_SERVER_URL__ = "%s";\n' "$ESCAPED_VALUE" > "$OUT_FILE"
