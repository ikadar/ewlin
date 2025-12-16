---
description: Generate unit test from AC Given/When/Then
---

# Generate Test: $ARGUMENTS

Generate PHPUnit test from an Acceptance Criteria specification.

**Input:** $ARGUMENTS (AC ID, e.g., AC-TASK-001)

---

## Step 1: Read AC Specification

### 1.1 Parse Input

Extract the AC ID from: **$ARGUMENTS**

If no valid AC ID provided, show usage:
```
Usage: /generate-test AC-XXX-NNN

Example: /generate-test AC-TASK-001
```

### 1.2 Read the AC

1. Search for the AC in `docs/requirements/acceptance-criteria.md`
2. Extract:
   - AC ID and title
   - Given/When/Then scenarios
   - Referenced specs (to understand context)

### 1.3 Find Implementation

Search for existing @spec annotation:
```bash
grep -rn "@spec {AC-ID}" services/php-api/src/
```

If found, note the implementation location for test targeting.

### 1.4 Present Analysis

Present the test plan and **STOP - wait for approval**:

```markdown
## Test Generation Plan

**AC:** {AC-ID} - {Title}

**Given/When/Then:**
```
Given {precondition}
When {action}
Then {expected result}
```

**Implementation found:**
- `{file_path}:{line}` - {method/class}

**Proposed test location:**
- `tests/Unit/{path}/{Test}Test.php` or
- `tests/Integration/{path}/{Test}Test.php`

**Test method name:**
- `test_AC_{ID}_{descriptive_name}()`

---
**Generate this test? (yes / modify / cancel)**
```

---

## Step 2: Generate Test (after approval)

### 2.1 Determine Test Type

| Implementation Type | Test Type | Location |
|--------------------|-----------|----------|
| Entity method | Unit | `tests/Unit/Entity/{Entity}Test.php` |
| Service method | Unit | `tests/Unit/Service/{Service}Test.php` |
| Value Object | Unit | `tests/Unit/ValueObject/{VO}Test.php` |
| Controller endpoint | Integration | `tests/Integration/Controller/Api/V1/{Controller}Test.php` |

### 2.2 Generate Test Code

Generate PHPUnit test following project patterns:

**Unit Test Pattern:**
```php
/**
 * @spec AC-{ID}
 */
public function test_AC_{ID}_{descriptive_name}(): void
{
    // Given: {precondition from AC}
    $subject = new Entity(...);
    // setup preconditions

    // When: {action from AC}
    $result = $subject->method($params);

    // Then: {expected result from AC}
    $this->assertEquals($expected, $result);
    // or $this->assertTrue(...);
    // or $this->assertSame(...);
}
```

**Validation Test Pattern (for BR constraints):**
```php
/**
 * @spec AC-{ID}
 * @spec BR-{ID}
 */
public function test_AC_{ID}_rejects_invalid_input(): void
{
    // Given: invalid input
    $invalidValue = -1;

    // When/Then: exception expected
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessage('...');

    $subject->method($invalidValue);
}
```

**Integration Test Pattern:**
```php
/**
 * @spec AC-{ID}
 */
public function test_AC_{ID}_{descriptive_name}(): void
{
    // Given: preconditions in database
    $this->loadFixtures([...]);

    // When: API call
    $this->client->request('POST', '/api/v1/...', [...]);

    // Then: expected response
    $this->assertResponseIsSuccessful();
    $response = json_decode($this->client->getResponse()->getContent(), true);
    $this->assertEquals($expected, $response['field']);
}
```

### 2.3 Present Generated Test

Present the generated test and **STOP - wait for save confirmation**:

```markdown
## Generated Test

### File: `{test_file_path}`

```php
{generated test code}
```

---
**Save this test? (yes / modify / cancel)**
```

---

## Step 3: Save & Run (after confirmation)

### 3.1 Save Test

1. If adding to existing test file: use Edit tool to add method
2. If creating new test file: use Write tool
3. Report the file operation

### 3.2 Run Test

Run the generated test in `services/php-api/` directory:

```bash
./vendor/bin/phpunit {test_file_path} --filter test_AC_{ID}
```

### 3.3 Report Results

```markdown
## Test Generation Complete

**File:** `{test_file_path}` ✅

**Test Run:**
- Result: ✅ PASSED / ❌ FAILED
- Time: {time}ms

**Traceability:**
- Test method: `test_AC_{ID}_{name}`
- @spec annotation: AC-{ID}

---
**Next steps:**
- Run `/spec-check {AC-ID}` to verify full traceability
- Run full test suite: `./vendor/bin/phpunit`
```

---

## Important Rules

- **NEVER** generate test without reading the full AC specification
- **NEVER** save test without user approval
- **ALWAYS** add @spec annotation to test method
- **ALWAYS** name test with pattern: `test_AC_{ID}_{descriptive_name}`
- **ALWAYS** structure test as Arrange/Act/Assert (Given/When/Then)
- **ALWAYS** run the test after saving to verify it passes
- **ALWAYS** follow existing test patterns in the project
- Communication in the user's language (Hungarian for this project)

---

## Test Naming Convention

Test method names follow this pattern:
```
test_AC_{ID}_{what_it_tests}
```

Examples:
- `test_AC_TASK_001_accepts_valid_weight()`
- `test_AC_TASK_001_rejects_negative_weight()`
- `test_AC_TASK_001_allows_null_weight()`
- `test_AC_GATE_001_blocks_scheduling_without_bat()`

---

## Multiple Scenarios

If the AC has multiple Given/When/Then scenarios or edge cases, generate multiple test methods:

```php
/**
 * @spec AC-{ID}
 */
public function test_AC_{ID}_happy_path(): void { ... }

/**
 * @spec AC-{ID}
 */
public function test_AC_{ID}_edge_case_null(): void { ... }

/**
 * @spec AC-{ID}
 * @spec BR-{ID}
 */
public function test_AC_{ID}_validation_error(): void { ... }
```
