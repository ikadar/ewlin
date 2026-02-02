#!/bin/bash
# Fetch SonarQube results without running scan
# Usage: ./scripts/sonar-fetch.sh <SONAR_TOKEN>

SONAR_TOKEN="${1:-$SONAR_TOKEN}"
SONAR_URL="http://localhost:9000"
PROJECT_KEY="flux-web"
REPORT_FILE="sonar-report.json"

if [ -z "$SONAR_TOKEN" ]; then
  echo "Error: SONAR_TOKEN required"
  exit 1
fi

echo "=== Fetching SonarQube results ==="

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
echo "Quality Gate: $(echo "$QUALITY_GATE" | jq -r '.projectStatus.status')"
echo ""
echo "Metrics:"
echo "$METRICS" | jq -r '.component.measures[] | "  \(.metric): \(.value)"' 2>/dev/null || echo "  (install jq for formatted output)"
echo ""
echo "Issues by Severity:"
echo "$ISSUES" | jq -r '.facets[] | select(.property=="severities") | .values[] | "  \(.val): \(.count)"' 2>/dev/null
echo ""
echo "Issues by Type:"
echo "$ISSUES" | jq -r '.facets[] | select(.property=="types") | .values[] | "  \(.val): \(.count)"' 2>/dev/null
echo ""
echo "Quality Gate Conditions:"
echo "$QUALITY_GATE" | jq -r '.projectStatus.conditions[] | "  \(.metricKey): \(.actualValue) (threshold: \(.errorThreshold)) - \(.status)"' 2>/dev/null
echo ""
echo "Full report: $REPORT_FILE"
