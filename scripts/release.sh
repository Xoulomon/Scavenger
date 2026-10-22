#!/usr/bin/env bash
#
# scripts/release.sh - Single release entry point
#
# Consolidates the previously separate release scripts:
#   - scripts/release-notes.sh       -> `notes` subcommand
#   - scripts/changelog-generator.sh -> `changelog` subcommand
#   - scripts/release-tracking.sh    -> `track` subcommand
#   - scripts/release-automation.sh  -> `publish` subcommand (notes/version/tag portions)
#
# The single source of truth for the version and versioning rules is
# config/release-versioning.yaml.
#
# Usage:
#   scripts/release.sh <subcommand> [options]
#
# Subcommands:
#   notes      Generate release notes for a version
#   changelog  Generate/update the changelog
#   track      Track release progress / status
#   publish    Publish a release (notes + version + tag)
#
# Run `scripts/release.sh <subcommand> --help` for subcommand options.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${REPO_ROOT}/config/release-versioning.yaml"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info()  { printf '[INFO]  %s\n' "$*" >&2; }
log_warn()  { printf '[WARN]  %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }
die()       { log_error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    cat <<'EOF'
Usage: scripts/release.sh <subcommand> [options]

Single entry point for the release process. The version and versioning rules
are read from config/release-versioning.yaml.

Subcommands:
  notes       Generate release notes for a version
  changelog   Generate or update the changelog
  track       Track release progress / status
  publish     Publish a release (generate notes, bump version, create tag)

Common options:
  -h, --help              Show this help message
  -c, --config <path>     Path to release-versioning.yaml
                          (default: config/release-versioning.yaml)
  -v, --version <ver>     Override the version from the config file
  -n, --dry-run           Show what would be done without making changes

Run `scripts/release.sh <subcommand> --help` for subcommand-specific options.

Examples:
  scripts/release.sh notes --version 1.2.3
  scripts/release.sh changelog
  scripts/release.sh track --version 1.2.3
  scripts/release.sh publish --version 1.2.3 --dry-run
EOF
}

# ---------------------------------------------------------------------------
# Config parsing (single version source: config/release-versioning.yaml)
# ---------------------------------------------------------------------------
# Reads a top-level scalar key from the YAML config. Prefers `yq` when
# available, otherwise falls back to a small grep/sed parser that handles
# simple `key: value` pairs.
config_get() {
    local key="$1"
    [ -f "${CONFIG_FILE}" ] || die "Config file not found: ${CONFIG_FILE}"

    if command -v yq >/dev/null 2>&1; then
        local val
        val="$(yq -r ".${key} // \"\" " "${CONFIG_FILE}" 2>/dev/null || true)"
        if [ -n "${val}" ] && [ "${val}" != "null" ]; then
            printf '%s\n' "${val}"
            return 0
        fi
    fi

    # Fallback: simple parser for top-level `key: value` entries.
    local line
    line="$(grep -E "^[[:space:]]*${key}[[:space:]]*:" "${CONFIG_FILE}" | head -n1 || true)"
    [ -n "${line}" ] || return 0
    printf '%s\n' "${line}" \
        | sed -E "s/^[[:space:]]*${key}[[:space:]]*:[[:space:]]*//" \
        | sed -E 's/[[:space:]]+#.*$//' \
        | sed -E 's/^"(.*)"$/\1/' \
        | sed -E "s/^'(.*)'\$/\1/" \
        | sed -E 's/[[:space:]]+$//'
}

# Resolve the version: explicit override wins, otherwise read from config.
resolve_version() {
    if [ -n "${VERSION_OVERRIDE}" ]; then
        printf '%s\n' "${VERSION_OVERRIDE}"
        return 0
    fi
    local v
    v="$(config_get version)"
    [ -n "${v}" ] || die "No version found in ${CONFIG_FILE} (expected a top-level 'version:' key)"
    printf '%s\n' "${v}"
}

# ---------------------------------------------------------------------------
# Shared argument parsing
# ---------------------------------------------------------------------------
VERSION_OVERRIDE=""
DRY_RUN="false"
SUBCOMMAND=""
SUBCOMMAND_ARGS=()

parse_common_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -c|--config)
                [ "$#" -ge 2 ] || die "Option $1 requires an argument"
                CONFIG_FILE="$2"
                shift 2
                ;;
            -v|--version)
                [ "$#" -ge 2 ] || die "Option $1 requires an argument"
                VERSION_OVERRIDE="$2"
                shift 2
                ;;
            -n|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -*)
                die "Unknown option: $1 (see --help)"
                ;;
            *)
                SUBCOMMAND="$1"
                shift
                SUBCOMMAND_ARGS=("$@")
                return 0
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Subcommand: notes
# ---------------------------------------------------------------------------
cmd_notes() {
    local version
    version="$(resolve_version)"
    log_info "Generating release notes for version ${version}"

    local prev_tag
    prev_tag="$(git -C "${REPO_ROOT}" describe --tags --abbrev=0 2>/dev/null || true)"
    local range="HEAD"
    if [ -n "${prev_tag}" ]; then
        range="${prev_tag}..HEAD"
    fi

    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[dry-run] Would generate notes for ${version} from ${range}"
        return 0
    fi

    local out_dir="${REPO_ROOT}/docs/releases"
    mkdir -p "${out_dir}"
    local out_file="${out_dir}/RELEASE_NOTES_${version}.md"

    {
        printf '# Release %s\n\n' "${version}"
        printf '## Changes\n\n'
        git -C "${REPO_ROOT}" log --pretty=format:'- %s (%h)' "${range}" || true
        printf '\n'
    } > "${out_file}"

    log_info "Release notes written to ${out_file}"
}

# ---------------------------------------------------------------------------
# Subcommand: changelog
# ---------------------------------------------------------------------------
cmd_changelog() {
    local version
    version="$(resolve_version)"
    log_info "Generating changelog for version ${version}"

    local changelog="${REPO_ROOT}/CHANGELOG.md"

    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[dry-run] Would update ${changelog} with ${version}"
        return 0
    fi

    local prev_tag
    prev_tag="$(git -C "${REPO_ROOT}" describe --tags --abbrev=0 2>/dev/null || true)"
    local range="HEAD"
    if [ -n "${prev_tag}" ]; then
        range="${prev_tag}..HEAD"
    fi

    local tmp
    tmp="$(mktemp)"
    {
        printf '## [%s] - %s\n\n' "${version}" "$(date +%Y-%m-%d)"
        git -C "${REPO_ROOT}" log --pretty=format:'- %s (%h)' "${range}" || true
        printf '\n\n'
        if [ -f "${changelog}" ]; then
            cat "${changelog}"
        fi
    } > "${tmp}"
    mv "${tmp}" "${changelog}"

    log_info "Changelog updated at ${changelog}"
}

# ---------------------------------------------------------------------------
# Subcommand: track
# ---------------------------------------------------------------------------
cmd_track() {
    local version
    version="$(resolve_version)"
    log_info "Tracking release ${version}"

    local tag="v${version}"
    local status="pending"

    if git -C "${REPO_ROOT}" rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1; then
        status="tagged"
    fi

    printf 'Release: %s\n' "${version}"
    printf 'Tag:     %s\n' "${tag}"
    printf 'Status:  %s\n' "${status}"

    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[dry-run] Tracking only; no changes made"
    fi
}

# ---------------------------------------------------------------------------
# Subcommand: publish
# ---------------------------------------------------------------------------
cmd_publish() {
    local version
    version="$(resolve_version)"
    local tag="v${version}"
    log_info "Publishing release ${version} (tag ${tag})"

    if git -C "${REPO_ROOT}" rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1; then
        die "Tag ${tag} already exists"
    fi

    if [ "${DRY_RUN}" = "true" ]; then
        log_info "[dry-run] Would generate notes, update changelog, and create tag ${tag}"
        cmd_notes
        cmd_changelog
        return 0
    fi

    cmd_notes
    cmd_changelog

    git -C "${REPO_ROOT}" tag -a "${tag}" -m "Release ${version}"
    log_info "Created tag ${tag}"
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
main() {
    if [ "$#" -eq 0 ]; then
        usage
        exit 1
    fi

    parse_common_args "$@"

    [ -n "${SUBCOMMAND}" ] || { usage; exit 1; }

    # Re-parse subcommand args for common flags (e.g. --dry-run after subcommand).
    local remaining=()
    local arg
    for arg in "${SUBCOMMAND_ARGS[@]+"${SUBCOMMAND_ARGS[@]}"}"; do
        case "${arg}" in
            -h|--help)
                usage
                exit 0
                ;;
            -n|--dry-run)
                DRY_RUN="true"
                ;;
            -v|--version)
                # handled below with value
                remaining+=("${arg}")
                ;;
            *)
                remaining+=("${arg}")
                ;;
        esac
    done

    # Handle --version <val> pairs in subcommand args.
    local i=0
    local parsed=()
    while [ "${i}" -lt "${#remaining[@]}" ]; do
        if [ "${remaining[${i}]}" = "-v" ] || [ "${remaining[${i}]}" = "--version" ]; then
            [ $((i + 1)) -lt "${#remaining[@]}" ] || die "Option ${remaining[${i}]} requires an argument"
            VERSION_OVERRIDE="${remaining[$((i + 1))]}"
            i=$((i + 2))
        else
            parsed+=("${remaining[${i}]}")
            i=$((i + 1))
        fi
    done

    case "${SUBCOMMAND}" in
        notes)     cmd_notes ;;
        changelog) cmd_changelog ;;
        track)     cmd_track ;;
        publish)   cmd_publish ;;
        -h|--help) usage ;;
        *)
            log_error "Unknown subcommand: ${SUBCOMMAND}"
            usage
            exit 1
            ;;
    esac
}

main "$@"