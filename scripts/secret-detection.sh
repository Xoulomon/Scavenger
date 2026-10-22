#!/usr/bin/env bash
# Secret Detection and Remediation Script
# Implements real repository secret scanning and remediation for issue #974.
#
# Usage: ./scripts/secret-detection.sh [command] [--help]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
# YELLOW is defined but currently only used via NC; kept for future use.
# shellcheck disable=SC2034
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORT_DIR="security-reports"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
GITLEAKS_REPORT="$REPORT_DIR/gitleaks_${TIMESTAMP}.json"
REMEDIATION_LOG="$REPORT_DIR/remediation_${TIMESTAMP}.log"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔍 Starting comprehensive secret detection and remediation...${NC}"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$REMEDIATION_LOG"
}

# Function to check if gitleaks is installed
check_gitleaks() {
    if ! command -v gitleaks &> /dev/null; then
        echo -e "${RED}❌ gitleaks is not installed. Please install it first:${NC}"
        echo "brew install gitleaks"
        echo "# or"
        echo "go install github.com/gitleaks/gitleaks/v8@latest"
        exit 1
    fi
    log "✅ gitleaks found: $(gitleaks version)"
}

# Function to scan the current repository
scan_repository() {
    log "🔍 Scanning repository for secrets..."

    # Remove any stale report so we never process results from a previous run
    rm -f "$GITLEAKS_REPORT"

    # Run gitleaks with our configuration. Capture the exit code immediately:
    # `if cmd; then` would mask the real status, and `$?` after the `else`
    # branch reflects the failed condition, not gitleaks itself.
    local exit_code=0
    gitleaks detect --config .gitleaks.toml --report-format json --report-path "$GITLEAKS_REPORT" --verbose || exit_code=$?

    case "$exit_code" in
        0)
            log "✅ No secrets detected in repository"
            return 0
            ;;
        1)
            log "⚠️ Secrets detected - processing report"
            return 1
            ;;
        *)
            log "❌ Error running gitleaks (exit code: $exit_code)"
            return "$exit_code"
            ;;
    esac
}

# Function to process and categorize findings
process_findings() {
    if [ ! -f "$GITLEAKS_REPORT" ]; then
        log "📊 No findings to process"
        return 0
    fi

    log "📊 Processing findings from $GITLEAKS_REPORT"

    # Count findings by type
    local total_findings
    total_findings=$(jq '. | length' "$GITLEAKS_REPORT")

    if [ "$total_findings" -eq 0 ]; then
        log "✅ No secrets found"
        return 0
    fi

    log "Found $total_findings potential secrets"

    # Group by rule ID
    jq -r '.[] | .RuleID' "$GITLEAKS_REPORT" | sort | uniq -c | while read -r count rule; do
        log "  - $rule: $count findings"
    done

    # List high-risk findings (not in test or doc files)
    local high_risk_findings
    high_risk_findings=$(jq '[.[] | select(.File | test("^(?!.*(test|spec|example|doc/)).*$"))] | length' "$GITLEAKS_REPORT")

    if [ "$high_risk_findings" -gt 0 ]; then
        log "⚠️ High-risk findings (outside test/doc files): $high_risk_findings"
        echo -e "${RED}High-risk secrets found:${NC}"
        jq -r '.[] | select(.File | test("^(?!.*(test|spec|example|doc/)).*$")) | "  - \(.File):\(.StartLine) (\(.RuleID))"' "$GITLEAKS_REPORT"
        return 1
    else
        log "✅ All findings are in test/doc files (lower risk)"
        return 0
    fi
}

# Function to write a concise, PR-attachable summary of the scan
write_summary() {
    local summary_file="$REPORT_DIR/secret_scan_summary_${TIMESTAMP}.md"
    local total_findings=0
    local high_risk_findings=0

    if [ -f "$GITLEAKS_REPORT" ]; then
        total_findings=$(jq '. | length' "$GITLEAKS_REPORT" 2>/dev/null || echo 0)
        high_risk_findings=$(jq '[.[] | select(.File | test("^(?!.*(test|spec|example|doc/)).*$"))] | length' "$GITLEAKS_REPORT" 2>/dev/null || echo 0)
    fi

    {
        echo "# Secret Scan Summary"
        echo
        echo "- **Date**: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "- **Config**: .gitleaks.toml"
        echo "- **gitleaks version**: $(gitleaks version 2>/dev/null || echo unknown)"
        echo "- **JSON report**: $GITLEAKS_REPORT"
        echo "- **Total findings**: $total_findings"
        echo "- **Unallowlisted high-risk findings**: $high_risk_findings"
        echo
        if [ "$total_findings" -gt 0 ]; then
            echo "## Findings by rule"
            echo
            jq -r '.[] | .RuleID' "$GITLEAKS_REPORT" | sort | uniq -c | while read -r count rule; do
                echo "- $rule: $count"
            done
        fi
    } > "$summary_file"

    log "📋 Scan summary written to: $summary_file"
}

# Function to suggest remediations
suggest_remediations() {
    if [ ! -f "$GITLEAKS_REPORT" ] || [ "$(jq '. | length' "$GITLEAKS_REPORT")" -eq 0 ]; then
        return 0
    fi

    log "💡 Generating remediation suggestions..."

    local suggestions_file="$REPORT_DIR/remediation_suggestions_${TIMESTAMP}.md"

    # Write the header and high-priority section together using a grouped redirect
    {
      cat << 'EOF'
# Secret Detection Remediation Suggestions

## Immediate Actions Required

### High-Priority Secrets (Production Risk)
EOF

      # Add high-risk findings
      if jq -e '.[] | select(.File | test("^(?!.*(test|spec|example|doc/)).*$"))' "$GITLEAKS_REPORT" > /dev/null; then
          echo "Found high-risk secrets that need immediate attention:"
          jq -r '.[] | select(.File | test("^(?!.*(test|spec|example|doc/)).*$")) |
          "
### \(.File):\(.StartLine)
- **Rule**: \(.RuleID)
- **Secret**: `\(.Secret[0:20])...` (truncated)
- **Action**:
  1. Rotate/revoke this credential immediately
  2. Remove from code and use environment variables
  3. Add to .gitignore or use secrets management
  4. Check if this secret was used in production

"' "$GITLEAKS_REPORT"
      else
          echo "✅ No high-risk secrets found in production code."
      fi

      cat << 'EOF'

### Medium-Priority (Test/Documentation)
These findings are in test or documentation files but should still be reviewed:

EOF

      # Add test/doc findings
      jq -r '.[] | select(.File | test(".*(test|spec|example|doc/).*")) |
      "- **\(.File):\(.StartLine)** - \(.RuleID)
  - Consider using placeholder tokens like `${YOUR_API_TOKEN}` or `EXAMPLE_TOKEN`
  - Ensure test tokens are clearly marked as non-functional
"' "$GITLEAKS_REPORT"

      cat << 'EOF'

## Recommended Security Improvements

1. **Environment Variables**: Store all secrets in environment variables
   ```bash
   export API_TOKEN="your-secret-here"
   export DATABASE_URL="postgresql://..."
   ```

2. **Secrets Management**: Consider using:
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - Kubernetes Secrets

3. **Git Hooks**: Install pre-commit hooks to prevent secret commits:
   ```bash
   # Install pre-commit hook
   echo '#!/bin/bash
   gitleaks protect --config .gitleaks.toml --staged --verbose
   ' > .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

4. **Code Review**: Always review code changes for potential secrets

5. **Regular Scanning**: Run this script regularly or in CI/CD pipelines

## Prevention Best Practices

- Use `.env.example` files with placeholder values
- Never commit `.env` files (add to `.gitignore`)
- Use configuration management tools
- Implement least-privilege access principles
- Regularly rotate credentials and API keys
- Monitor for credential usage anomalies

EOF
    } > "$suggestions_file"

    log "📋 Remediation suggestions written to: $suggestions_file"
}

# Function to scan specific paths for new secrets
scan_paths() {
    local paths=("$@")
    if [ ${#paths[@]} -eq 0 ]; then
        log "🔍 Scanning all tracked files..."
        # Use mapfile (readarray) to avoid word-splitting on filenames
        mapfile -t paths < <(git ls-files)
    fi

    log "🔍 Scanning ${#paths[@]} paths for secrets..."

    # Create temporary report for path scanning
    local path_report="$REPORT_DIR/path_scan_${TIMESTAMP}.json"

    for path in "${paths[@]}"; do
        if [ -f "$path" ]; then
            if ! gitleaks detect --config .gitleaks.toml --source "$path" --report-format json --report-path "$path_report" --no-git 2>/dev/null; then
                log "⚠️ Secrets found in: $path"
            fi
        fi
    done

    # Merge results if they exist
    if [ -f "$path_report" ] && [ "$(jq '. | length' "$path_report" 2>/dev/null || echo 0)" -gt 0 ]; then
        log "📊 Path scan found $(jq '. | length' "$path_report") secrets"
        jq -s 'add' "$GITLEAKS_REPORT" "$path_report" > "${GITLEAKS_REPORT}.tmp" 2>/dev/null && mv "${GITLEAKS_REPORT}.tmp" "$GITLEAKS_REPORT" || true
    fi

    rm -f "$path_report"
}

# Function to install pre-commit hook
install_hooks() {
    log "🪝 Installing git hooks for secret detection..."

    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
# Git pre-commit hook for secret detection
# Generated by secret-detection.sh

echo "🔍 Checking staged files for secrets..."

if ! command -v gitleaks &> /dev/null; then
    echo "⚠️ gitleaks not found - skipping secret detection"
    exit 0
fi

if ! gitleaks protect --config .gitleaks.toml --staged --verbose; then
    echo "❌ Secrets detected in staged files!"
    echo "Please remove secrets before committing."
    echo "Run './scripts/secret-detection.sh' for remediation suggestions."
    exit 1
fi

echo "✅ No secrets detected in staged files"
HOOK

    chmod +x .git/hooks/pre-commit
    log "✅ Pre-commit hook installed"

    # Create commit-msg hook for commit message scanning
    cat > .git/hooks/commit-msg << 'HOOK'
#!/bin/bash
# Git commit-msg hook for secret detection in commit messages

commit_msg="$1"

# Check for potential secrets in commit message
if grep -qE "(password|secret|key|token).*[:=]" "$commit_msg"; then
    echo "⚠️ Potential secret detected in commit message!"
    echo "Please avoid including sensitive information in commit messages."
    exit 1
fi
HOOK

    chmod +x .git/hooks/commit-msg
    log "✅ Commit-msg hook installed"
}

# Main execution
main() {
    check_gitleaks

    # Parse command line arguments
    case "${1:-scan}" in
        "scan")
            local scan_result=0
            scan_repository || scan_result=$?
            local process_result=0
            process_findings || process_result=$?
            suggest_remediations
            write_summary

            if [ "$scan_result" -ne 0 ] || [ "$process_result" -ne 0 ]; then
                echo -e "${RED}❌ Secret detection found unallowlisted high-risk secrets. Check the remediation suggestions.${NC}"
                exit 1
            else
                echo -e "${GREEN}✅ No secrets detected or all findings are low-risk.${NC}"
            fi
            ;;
        "paths")
            shift
            scan_paths "$@"
            local process_result=0
            process_findings || process_result=$?
            suggest_remediations
            write_summary
            if [ "$process_result" -ne 0 ]; then
                exit 1
            fi
            ;;
        "install-hooks")
            install_hooks
            ;;
        "help"|"--help"|"-h")
            cat << EOF
Secret Detection and Remediation Script

Usage:
  $0 [command] [options]

Commands:
  scan              Scan the entire repository (default)
  paths [files...]  Scan specific file paths
  install-hooks     Install git hooks for automatic scanning
  help             Show this help message

Examples:
  $0                                    # Scan entire repository
  $0 paths src/ docs/                   # Scan specific directories
  $0 install-hooks                      # Install pre-commit hooks

Reports are saved to: $REPORT_DIR/
EOF
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Use '$0 help' for usage information."
            exit 1
            ;;
    esac
}

main "$@"
