---
description: Run SonarQube analysis and display results summary
---

# SonarQube Analysis

Run SonarQube analysis on the Flux web app and display a summary of issues.

## Steps

1. **Run the SonarQube scanner** from the web app directory:

```bash
cd /Users/istvan/Code/ewlin/apps/web && pnpm sonar:report sqp_814fb3baaa82a69e059a46c2312ce4236a439326
```

2. **Query and display results** - fetch open issues from the API and create a summary table:

```bash
curl -s -u "sqp_814fb3baaa82a69e059a46c2312ce4236a439326:" \
  "http://localhost:9000/api/issues/search?componentKeys=flux-web&ps=500&resolved=false" | \
python3 << 'PYTHON'
import sys, json

data = json.load(sys.stdin)
issues = data.get('issues', [])

# Count by severity
severity_counts = {}
for issue in issues:
    sev = issue.get('severity', 'UNKNOWN')
    severity_counts[sev] = severity_counts.get(sev, 0) + 1

severity_order = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO']
print()
print('=' * 60)
print('SONARQUBE ANALYSIS RESULTS')
print('=' * 60)
print()
print('Issues by Severity:')
print('-' * 30)
total = 0
for sev in severity_order:
    count = severity_counts.get(sev, 0)
    total += count
    if count > 0:
        bar = '#' * min(count, 40)
        print(f'  {sev:<12} {count:>4}  {bar}')
print('-' * 30)
print(f'  {"TOTAL":<12} {total:>4}')
print()

# Group CRITICAL and MAJOR by rule
rules = {}
for issue in issues:
    if issue.get('severity') in ['CRITICAL', 'MAJOR']:
        rule = issue.get('rule', 'unknown')
        if rule not in rules:
            rules[rule] = {'count': 0, 'severity': issue.get('severity'), 'files': []}
        rules[rule]['count'] += 1
        comp = issue.get('component', '').split(':')[-1]
        line = issue.get('line', '?')
        rules[rule]['files'].append(f'{comp}:{line}')

if rules:
    print('CRITICAL & MAJOR Issues by Rule:')
    print('-' * 60)
    for rule, data in sorted(rules.items(), key=lambda x: (-['CRITICAL', 'MAJOR'].index(x[1]['severity']) if x[1]['severity'] in ['CRITICAL', 'MAJOR'] else 0, -x[1]['count'])):
        sev_mark = '!!' if data['severity'] == 'CRITICAL' else '!'
        print(f'{sev_mark} {rule}: {data["count"]} issues')
        for f in data['files'][:3]:
            print(f'     {f}')
        if len(data['files']) > 3:
            print(f'     ... +{len(data["files"])-3} more')
    print()

print('=' * 60)
PYTHON
```

3. **Report the results** to the user with the summary table.
