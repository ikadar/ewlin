---
description: Generate code from AC with proper annotations
---

# Generate From Spec: $ARGUMENTS

Generate implementation code from an Acceptance Criteria specification.

**Input:** $ARGUMENTS (AC ID, e.g., AC-TASK-001)

---

## Step 1: Read & Analyze Specification

### 1.1 Parse Input

Extract the AC ID from: **$ARGUMENTS**

If no valid AC ID provided, show usage:
```
Usage: /generate-from-spec AC-XXX-NNN

Example: /generate-from-spec AC-TASK-001
```

### 1.2 Read the AC Specification

1. Search for the AC in `docs/requirements/acceptance-criteria.md`
2. Extract:
   - AC ID and title
   - References (US, BR, API/IC)
   - Given/When/Then scenarios

### 1.3 Read Referenced Specifications

Read all referenced specs:
- **US-***: User story context (role, goal, benefit)
- **BR-***: Business rules and constraints
- **API-***: API interface draft (endpoint, method)
- **IC-***: Interface contract details

### 1.4 Present Analysis

Present the gathered context and **STOP - wait for approval**:

```markdown
## Specification Analysis

**AC:** {AC-ID} - {Title}
> {Given/When/Then content}

**Referenced Specifications:**
- US: {US-ID} - {summary}
- BR: {BR-ID} - {rule description}
- API: {API-ID} - {endpoint info} (if present)

**Detected Implementation Type:**
- [ ] Entity field/method
- [ ] Service logic
- [ ] Controller endpoint
- [ ] Value Object
- [ ] Repository method

**Proposed File to Generate/Modify:**
- `src/...` - {description}

---
**Proceed with code generation? (yes / modify / cancel)**
```

---

## Step 2: Generate Code (after approval)

### 2.1 Determine Code Location

Based on the spec analysis, determine where to place code:

| Spec Type | Code Location |
|-----------|---------------|
| Entity field | `src/Entity/{Entity}.php` |
| Service logic | `src/Service/{Service}Service.php` |
| Controller | `src/Controller/Api/V1/{Controller}Controller.php` |
| Value Object | `src/ValueObject/{VO}.php` |
| DTO | `src/DTO/{Domain}/{DTO}.php` |

### 2.2 Generate Implementation Code

Generate code with proper @spec annotations:

**Entity Field Example:**
```php
/**
 * @spec BR-TASK-010
 */
#[ORM\Column(name: 'output_weight_grams', type: 'integer', nullable: true)]
private ?int $outputWeightGrams = null;

/**
 * Get the output weight in grams.
 *
 * @spec AC-TASK-001
 */
public function getOutputWeightGrams(): ?int
{
    return $this->outputWeightGrams;
}

/**
 * Set the output weight in grams.
 *
 * @spec AC-TASK-001
 * @spec BR-TASK-010
 * @throws \InvalidArgumentException If weight is not positive
 */
public function setOutputWeightGrams(?int $grams): void
{
    if ($grams !== null && $grams <= 0) {
        throw new \InvalidArgumentException('Output weight must be a positive integer.');
    }
    $this->outputWeightGrams = $grams;
    $this->touch();
}
```

**Service Method Example:**
```php
/**
 * Validate and process {description}.
 *
 * @spec AC-XXX-NNN
 * @spec BR-XXX-NNN
 */
public function methodName(params): ReturnType
{
    // Given: {precondition from AC}

    // When: {action from AC}

    // Then: {expected result from AC}
}
```

### 2.3 Present Generated Code

Present the generated code and **STOP - wait for save confirmation**:

```markdown
## Generated Code

### Source: `{file_path}`

```php
{generated source code}
```

---
**Save this file? (yes / modify / cancel)**
```

---

## Step 3: Save & Verify (after confirmation)

### 3.1 Save File

1. If modifying existing file: use Edit tool
2. If creating new file: use Write tool
3. Report the file operation

### 3.2 Run Verification

After saving, run in `services/php-api/` directory:

1. Run syntax check:
   ```bash
   php -l {file_path}
   ```

2. Run PHPStan:
   ```bash
   ./vendor/bin/phpstan analyse {file_path} --level 8
   ```

### 3.3 Report Results

```markdown
## Generation Complete

**File Modified:**
- `{file_path}` ✅

**Verification:**
- Syntax check: ✅/❌
- PHPStan level 8: ✅/❌

**Traceability:**
- @spec {AC-ID} added to source

---
**Next steps:**
- Run `/generate-test {AC-ID}` to generate unit test
- Run `/spec-check {AC-ID}` to verify full traceability
- Run `/commit-with-spec` when ready to commit
```

---

## Important Rules

- **NEVER** generate code without reading the full AC specification
- **NEVER** save code without user approval
- **ALWAYS** add @spec annotations to generated code
- **ALWAYS** run verification after saving
- **ALWAYS** follow existing code patterns in the project
- **ALWAYS** use PHPStan level 8 compatible code
- Communication in the user's language (Hungarian for this project)

---

## Code Patterns Reference

### Entity Field Pattern
```php
#[ORM\Column(name: 'field_name', type: 'type', nullable: true/false)]
private ?Type $fieldName = null;

public function getFieldName(): ?Type { return $this->fieldName; }
public function setFieldName(?Type $value): void { $this->fieldName = $value; $this->touch(); }
```

### Service Method Pattern
```php
/**
 * @spec AC-XXX-NNN
 */
public function processAction(Entity $entity, mixed $params): Result
{
    // Validation (BR rules)
    // Business logic
    // Return result
}
```
