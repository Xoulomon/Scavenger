# Release Management

## Overview
The release management process automates versioning, changelog generation, artifact building, and deployment across environments.

## Release Process

### 1. Version Bumping
Releases follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes or significant new features
- **MINOR**: New features, non-breaking additions
- **PATCH**: Bug fixes, performance improvements, minor changes

### 2. Automated Release
All release steps are performed through a single entry point, `scripts/release.sh`, which exposes the `notes`, `changelog`, `track` and `publish` subcommands.

```bash
# Create a patch release
./scripts/release.sh publish patch

# Create a minor release
./scripts/release.sh publish minor

# Create a major release
./scripts/release.sh publish major
```

### 3. What the Release Script Does
1. Validates the working tree is clean
2. Ensures you're on the release branch
3. Fetches latest code from remote
4. Calculates the new version number
5. Updates version in all relevant files (Chart.yaml, package.json)
6. Creates a git tag
7. Builds all release artifacts
8. Generates release notes

### 4. Changelog Generation
```bash
# Generate full changelog
./scripts/release.sh changelog

# Generate changelog since specific tag
./scripts/release.sh changelog CHANGELOG.md v1.0.0
```

### 5. Release Notes
```bash
# Generate release notes for a version
./scripts/release.sh notes v1.2.3
```

## Release Workflows

### GitHub Actions
The release management workflow (`.github/workflows/release-management.yml`) runs automatically when a `v*` tag is pushed:

1. **Validate**: Verify the tag format
2. **Build**: Build and push Docker images to GHCR
3. **Release**: Create a GitHub Release with auto-generated notes
4. **Deploy**: Deploy to staging environment
5. **Notify**: Send Slack notification to the team

### Manual Release
```bash
# On main branch
git checkout main
git pull origin main

# Run release automation
./scripts/release.sh publish patch

# Push the tag
git push origin main --tags
```

## Release Tracking
```bash
# View release status
./scripts/release.sh track status

# List all releases
./scripts/release.sh track list

# Show release details
./scripts/release.sh track show v1.2.3

# View pending changes
./scripts/release.sh track pending
```

## Artifacts
Each release produces:
- Docker images: `ghcr.io/xoulomon/scavenger-{service}:{version}`
- Helm chart: Updated version in `k8s/Chart.yaml`
- Git tag: `v{version}`
- GitHub Release with release notes

## Version Files
`config/release-versioning.yaml` is the single source of truth for the version. All release subcommands read the version from this file only; the following files are updated to match it during a release:
- `k8s/Chart.yaml` - Helm chart version
- `frontend/package.json` - Frontend version
- `packages/scavenger-sdk/package.json` - SDK version

## Best Practices
1. Always test release candidates in staging before production
2. Tag releases immediately after merging to main
3. Write clear, descriptive commit messages using conventional commits
4. Generate and review changelog before each release
5. Verify all artifacts are published after release
6. Document any breaking changes prominently in release notes
