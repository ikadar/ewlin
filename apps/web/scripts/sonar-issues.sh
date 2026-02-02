#!/bin/bash
# Fetch detailed SonarQube issues for fixing
# Usage: ./scripts/sonar-issues.sh <SONAR_TOKEN> [severity]
# severity: BLOCKER, CRITICAL, MAJOR, MINOR, INFO (default: CRITICAL,MAJOR)

SONAR_TOKEN="${1:-$SONAR_TOKEN}"
SEVERITY="${2:-CRITICAL,MAJOR}"
SONAR_URL="http://localhost:9000"
PROJECT_KEY="flux-web"
OUTPUT_FILE="sonar-issues.json"

if [ -z "$SONAR_TOKEN" ]; then
  echo "Usage: ./scripts/sonar-issues.sh <TOKEN> [SEVERITY]"
  echo "  SEVERITY: BLOCKER,CRITICAL,MAJOR,MINOR,INFO (default: CRITICAL,MAJOR)"
  exit 1
fi

echo "Fetching $SEVERITY issues..."

# Fetch issues with details (max 500)
ISSUES=$(curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&severities=$SEVERITY&ps=500&statuses=OPEN,CONFIRMED,REOPENED")

# Save full JSON
echo "$ISSUES" > "$OUTPUT_FILE"

# Display summary
TOTAL=$(echo "$ISSUES" | jq '.total')
echo ""
echo "=== SonarQube Issues ($SEVERITY) ==="
echo "Total: $TOTAL issues"
echo ""

# Group by file and show details
echo "$ISSUES" | jq -r '
  .issues | group_by(.component) | .[] |
  "### " + (.[0].component | split(":") | .[1]) + " (" + (. | length | tostring) + " issues)\n" +
  (. | map("  - L" + (.line // 0 | tostring) + " [" + .severity + "] " + .message) | join("\n")) + "\n"
'

echo ""
echo "Full details saved to: $OUTPUT_FILE"
