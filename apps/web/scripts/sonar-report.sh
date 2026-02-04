#!/bin/bash
# SonarQube scan with JSON report generation
# Usage: ./scripts/sonar-report.sh <SONAR_TOKEN>

SONAR_TOKEN="${1:-$SONAR_TOKEN}"
SONAR_URL="http://localhost:9000"
PROJECT_KEY="flux-web"
REPORT_FILE="sonar-report.json"

if [ -z "$SONAR_TOKEN" ]; then
  echo "Error: SONAR_TOKEN required"
  echo "Usage: ./scripts/sonar-report.sh <token>"
  echo "   or: SONAR_TOKEN=xxx ./scripts/sonar-report.sh"
  exit 1
fi

echo "=== Running SonarQube scan ==="
pnpm sonar -Dsonar.token="$SONAR_TOKEN"

echo ""
echo "=== Fetching results from API ==="

# Wait a moment for processing
sleep 2

# Fetch metrics
METRICS=$(curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "$SONAR_URL/api/measures/component?component=$PROJECT_KEY&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,ncloc,security_hotspots,reliability_rating,security_rating,sqale_rating,alert_status")

# Fetch quality gate status
QUALITY_GATE=$(curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "$SONAR_URL/api/qualitygates/project_status?projectKey=$PROJECT_KEY")

# Fetch issues summary
ISSUES=$(curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&ps=1&facets=severities,types")

# Combine into single JSON report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "$PROJECT_KEY",
  "metrics": $METRICS,
  "qualityGate": $QUALITY_GATE,
  "issuesSummary": $ISSUES
}
EOF

echo ""
echo "=== SonarQube Report ==="
echo ""

# Parse and display results
if command -v jq &> /dev/null; then
  echo "Quality Gate: $(echo "$QUALITY_GATE" | jq -r '.projectStatus.status')"
  echo ""
  echo "Metrics:"
  echo "$METRICS" | jq -r '.component.measures[] | "  \(.metric): \(.value)"'
  echo ""
  echo "Issues by Severity:"
  echo "$ISSUES" | jq -r '.facets[] | select(.property=="severities") | .values[] | "  \(.val): \(.count)"'
  echo ""
  echo "Full report saved to: $REPORT_FILE"
else
  echo "Install 'jq' for formatted output, or see: $REPORT_FILE"
  cat "$REPORT_FILE"
fi
