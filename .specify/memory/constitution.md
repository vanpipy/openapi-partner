# Project Constitution

## Core Principles

### 1. Type & Memory Safety
- **typescript**-specific safety practices:
    - Follow typescript community best practices for safety

### 2. Zero-Cost Abstractions
- Leverage typescript language features for zero or low-cost abstractions

### 3. TDD (Test-Driven Development)
- **Test First**: Write failing tests before implementation
- **Red-Green-Refactor**: Strictly follow TDD cycle
- **Test Naming**: `test_<function>_<scenario>_<expected_outcome>`
- **Test Framework**: Use **bun**
- **Doc Testing**: Public APIs must have example code blocks
- **Static Analysis**: Use **tsc** for code quality

### 4. Error Handling
- Follow typescript community best practices for error handling

### 5. Performance Requirements
- Low latency, high concurrency
- Use typescript concurrency primitives
- Avoid lock contention and blocking operations on critical paths

### 6. Governance Rules
- All public APIs must have complete documentation comments
- Critical modules must have adequate test coverage and static analysis
- Code reviews must verify tests precede implementation

## Language Configuration
- Programming Language: typescript
- Test Framework: bun
- Static Analysis: tsc
- Code Comments Language: English
- Documentation Language: en
- File/Path Naming: English
