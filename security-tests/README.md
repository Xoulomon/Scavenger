# Security Testing Suite

Comprehensive security testing suite for the Scavenger platform using OWASP ZAP and custom security tests.

## Overview

This directory contains security tests covering:
- SQL Injection vulnerabilities
- XSS (Cross-Site Scripting) vulnerabilities
- CSRF (Cross-Site Request Forgery) vulnerabilities
- Authentication/Authorization flaws
- IDOR (Insecure Direct Object References) / Broken Object-Level Authorization
- Broken Authentication
- Injection & Input Validation
- Rate limiting enforcement
- API security
- Input validation
- Path Traversal
- Header Injection

## Setup

Base environment setup (Node.js, Docker, running services) is in the canonical guide:

➡️ **[Developer Onboarding Guide](../docs/DEVELOPER_ONBOARDING.md#development-environment-setup)**

Additional tools for this suite only:

- OWASP ZAP — optional, for automated scanning
- curl or Postman — for manual API probing

```bash
npm install
```

## Running Tests

### Unit Security Tests

```bash
npm test
```

### Integration Security Tests

```bash
npm run test:integration
```

### Full Security Suite

```bash
npm run test:security
```

### Running a Specific Test File

```bash
npx vitest run tests/idor.test.ts
npx vitest run tests/broken-authentication.test.ts
npx vitest run tests/injection-input-validation.test.ts
```

## Environment Requirements

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3000/api` | Target API base URL |

**IMPORTANT**: Security tests must only run against authorized local/staging/test environments. Never run against production.

## Test Coverage

### 1. SQL Injection Tests (3 tests)
- Test parameterized queries
- Test input sanitization
- Test prepared statements

### 2. XSS Vulnerability Tests (3 tests)
- Test HTML encoding
- Test JavaScript context escaping
- Test attribute encoding

### 3. CSRF Protection Tests (2 tests)
- Test CSRF token validation
- Test SameSite cookie attributes

### 4. Authentication/Authorization Tests (4 tests)
- Test JWT token validation
- Test role-based access control
- Test session management
- Test password policies

### 5. Rate Limiting Tests (3 tests)
- Test request rate limits
- Test IP-based throttling
- Test user-based throttling

### 6. API Security Tests (3 tests)
- Test HTTPS enforcement
- Test API key validation
- Test CORS policies

### 7. Input Validation Tests (2 tests)
- Test boundary conditions
- Test malformed input handling

### 8. IDOR / Broken Object-Level Authorization Tests (11 tests) — NEW
- Waste resource ownership enforcement
- Participant resource ownership enforcement
- Incentive resource ownership enforcement
- API endpoint enumeration resistance
- Resource existence leakage prevention

### 9. Broken Authentication Tests (12 tests) — NEW
- Missing authentication on protected endpoints
- Malformed JWT tokens
- Invalid token signatures
- Empty/malformed bearer tokens
- Expired tokens
- Wallet-based authentication bypass
- Spoofed role/admin headers
- Session security headers

### 10. Injection & Input Validation Security Tests (25+ tests) — NEW
- SQL/ORM injection payloads
- XSS/script injection payloads
- Command injection payloads
- Malformed JSON & type confusion
- Oversized & boundary inputs
- Path traversal
- Header injection (CRLF)

## OWASP Top 10 Coverage

| OWASP Category | Test File | Status |
|----------------|-----------|--------|
| A01: Broken Access Control | `idor.test.ts` | Covered |
| A02: Cryptographic Failures | `broken-authentication.test.ts` | Covered |
| A03: Injection | `injection-input-validation.test.ts` | Covered |
| A04: Insecure Design | — | Manual review required |
| A05: Security Misconfiguration | `security.test.ts` | Covered |
| A06: Vulnerable Components | `scripts/zap-scan.js` | Covered |
| A07: Auth Failures | `broken-authentication.test.ts` | Covered |
| A08: Data Integrity Failures | `reentrancy.test.ts` | Covered |
| A09: Logging Failures | — | Manual review required |
| A10: SSRF | `injection-input-validation.test.ts` | Partial |

## Adding New Security Tests

1. Create a new file `tests/<category>.test.ts`
2. Import `describe`, `it`, `expect` from `vitest`
3. Import `axios` for HTTP requests
4. Use `process.env.API_URL || 'http://localhost:3000/api'` as the base URL
5. Wrap API calls in try/catch blocks
6. Assert correct HTTP status codes (not just "request failed")
7. Assert no sensitive information leakage in error responses
8. Verify state remains unchanged after rejected requests where applicable

### Test Naming Convention

```typescript
describe('Category Name', () => {
  describe('Subcategory', () => {
    it('should <expected behavior> when <condition>', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### What to Assert

- **Correct HTTP status**: 401 for missing auth, 403 for insufficient permissions, 400 for bad input
- **Error structure**: Response body should not contain stack traces, SQL errors, or internal paths
- **No state mutation**: Verify database/application state unchanged after rejected requests
- **No data leakage**: Error messages must not reveal resource ownership or existence

## Interpreting Failures

| Failure | Likely Cause |
|---------|-------------|
| Test returns 500 | Application bug — investigate immediately |
| Test returns unexpected status | Possible security issue or API contract change |
| Test passes but should fail | Security control may be missing |
| Test fails with connection error | Target environment not running |

## OWASP ZAP Integration

### Automated Scanning

```bash
npm run scan:zap
```

This runs OWASP ZAP in headless mode against the application.

### Manual Testing

1. Start OWASP ZAP
2. Configure proxy to localhost:8080
3. Navigate through the application
4. Run active scan
5. Review findings

## Security Test Results

Test results are generated in:
- `./reports/security-tests.json` - Detailed test results
- `./reports/zap-report.html` - OWASP ZAP scan report
- `./reports/coverage.json` - Security coverage metrics

## CI/CD Integration

Security tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled daily scans

See `.github/workflows/security.yml` for CI configuration.

## Never Commit Secrets

Before committing:
- Ensure no real API keys in test fixtures
- Ensure no private keys or certificates
- Ensure no real user credentials
- Use deterministic fake/test credentials only

## Remediation

For each security finding:
1. Document the vulnerability
2. Implement fix
3. Add regression test
4. Verify fix with security test
5. Update documentation

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
