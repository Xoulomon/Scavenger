#!/usr/bin/env bash
# Simple wrk load test runner.
#
# Usage: ./scripts/load-test.sh [url] [threads] [connections] [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [url] [threads] [connections]

Run a wrk load test against the given URL.

Arguments:
  url          Target URL         (default: https://api.scavenger.com)
  threads      Thread count       (default: 12)
  connections  Connection count   (default: 400)
EOF
  exit 0
fi
DURATION="${4:-30s}"

echo "Starting load test..."
echo "URL: $TARGET_URL"
echo "Threads: $THREADS"
echo "Connections: $CONNECTIONS"
echo "Duration: $DURATION"
echo ""

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
  echo "Installing wrk..."
  git clone https://github.com/wg/wrk.git /tmp/wrk
  cd /tmp/wrk
  make
  sudo cp wrk /usr/local/bin/
fi

# Run load test
wrk -t"$THREADS" -c"$CONNECTIONS" -d"$DURATION" \
  -s /dev/stdin "$TARGET_URL" << 'EOF'
request = function()
  wrk.method = "GET"
  wrk.path = "/health"
  return wrk.format(nil)
end

response = function(status, headers, body)
  if status ~= 200 then
    io.write("HTTP " .. status .. "\n")
  end
end
EOF

echo ""
echo "Load test completed"
