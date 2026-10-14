#!/usr/bin/env bash
# Smoke test: email sign-up must return 200 + a session cookie, and that
# cookie must resolve the same user on get-session. Requires the server running.
set -euo pipefail

BASE="${AUTH_URL:-http://localhost:3001/api/auth}"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="password123"

signup=$(curl -sS -i -X POST "$BASE/sign-up/email" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$signup" | grep -qi '^HTTP/.* 200' || {
  echo "FAIL: sign-up did not return 200"; echo "$signup" | head -20; exit 1;
}

cookie=$(printf '%s' "$signup" | grep -i '^set-cookie:' | head -1 \
  | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
[ -n "$cookie" ] || { echo "FAIL: sign-up set no session cookie"; exit 1; }

session=$(curl -sS "$BASE/get-session" -H "Cookie: $cookie")
echo "$session" | grep -q "$EMAIL" || {
  echo "FAIL: get-session did not return the signed-up user"; echo "$session"; exit 1;
}

echo "OK: auth smoke test passed ($EMAIL)"
