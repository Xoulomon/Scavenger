# Snapshot Review Process

This document describes the review process for visual regression snapshots in the Scavenger frontend.

## Overview

Snapshots are baseline PNG screenshots stored in `__snapshots__/` and compared on every PR that touches frontend source code. The goal is to catch unintended visual regressions while allowing intentional UI changes to land smoothly.

## Directory Structure

```
__snapshots__/
├── .gitignore              # Allows .png files to be committed
├── visual-chromium/        # Chromium baseline screenshots
│   └── .gitkeep
├── visual-firefox/         # Firefox baseline screenshots
│   └── .gitkeep
└── visual-mobile/          # Mobile (Pixel 5) baseline screenshots
    └── .gitkeep
```

## How Snapshots Work

1. **Generation**: `npm run visual:update` captures screenshots via Playwright's `toHaveScreenshot()`
2. **Storage**: Screenshots are stored per-browser at `__snapshots__/{projectName}/{testFilePath}/{arg}.png`
3. **Comparison**: On PRs, Playwright captures fresh screenshots and diffs against committed baselines
4. **Tolerance**: Up to 0.2% pixel difference is allowed (`maxDiffPixelRatio: 0.002`)
5. **Animations**: All CSS animations/transitions are disabled before capture for determinism

## Running Snapshot Tests

```bash
# Compare against baselines (will fail if diffs detected)
npm run visual

# Run specific browser only
npm run visual:chromium
npm run visual:firefox
npm run visual:mobile

# Regenerate baselines after intentional UI changes
npm run visual:update

# Open HTML diff report after a failure
npm run visual:report
```

## When to Update Snapshots

### Update snapshots when:
- You intentionally changed UI styling, layout, typography, or colors
- You added or modified UI components that appear in visual tests
- You changed page structure that affects the visual appearance
- A cross-browser rendering difference needs to be accepted

### Do NOT update snapshots when:
- You want to make failing tests pass without understanding why
- The diff shows unintended visual changes
- You are unsure whether the change is correct
- The change is in unrelated code

## Review Process

### For Authors

1. **Run visual tests locally** before pushing:
   ```bash
   npm run visual
   ```

2. **If tests fail**, inspect the diffs:
   ```bash
   npm run visual:report
   ```

3. **Evaluate each diff**:
   - Is the visual change intentional?
   - Does it match the design/requirements?
   - Are all three browser projects showing consistent changes?
   - Are mobile viewports affected correctly?

4. **If changes are intentional**, update baselines:
   ```bash
   npm run visual:update
   ```

5. **Commit only the snapshot changes** with a descriptive message:
   ```bash
   git add e2e/__snapshots__
   git commit -m "chore: update visual baselines for <feature description>"
   ```

6. **In your PR description**, explain what visual changes were made and why.

### For Reviewers

#### Review Checklist

- [ ] The underlying UI change is intentional
- [ ] The changed snapshot corresponds to an active test
- [ ] The visual difference is expected
- [ ] No unrelated snapshot changed
- [ ] Removed flows do not leave orphaned snapshots
- [ ] Browser/environment differences were considered
- [ ] The PR description explains meaningful visual changes
- [ ] All three browser projects (chromium, firefox, mobile) were considered
- [ ] No screenshots show sensitive data (tokens, addresses, real user data)

#### How to Review Visual Diffs

1. Open the PR's **Actions** tab and click the failed visual regression run
2. Download the `visual-diff-<project>` artifact
3. Open `playwright-report/index.html` to see side-by-side diffs
4. Compare the baseline (left) with the actual (right)
5. Look for:
   - **Green regions**: Pixel-perfect match
   - **Red regions**: Pixel differences detected
   - **Anti-aliasing artifacts**: Minor differences in text rendering are expected across browsers

#### Red Flags to Reject

- Snapshots changed for code you didn't modify
- Visual regressions in components unrelated to the PR
- New snapshot files appearing for deleted/renamed flows
- Inconsistent changes across browser projects (e.g., chromium changed but firefox didn't)
- Changes that show sensitive data or real user information

## Snapshot Maintenance

### Orphaned Snapshots

When a test is deleted or renamed, its snapshots become orphaned. To clean up:

1. Delete the corresponding snapshot directory
2. Commit the deletion
3. Verify no other test references those snapshots

### Adding New Snapshots

When adding new visual tests:

1. Add the test to `visual-regression.spec.ts`
2. Run `npm run visual:update` to generate the initial baseline
3. Verify the baseline looks correct
4. Commit both the test and the baseline together

### Cross-Browser Consistency

Each browser project produces its own baselines. If a visual change looks different across browsers:

1. Check if the difference is expected (e.g., font rendering, anti-aliasing)
2. If the difference is acceptable, update all three baselines
3. If the difference indicates a bug, fix the underlying issue first

## Environment Considerations

Visual snapshots can vary across:
- **Operating systems**: macOS, Linux, Windows render fonts differently
- **GPU acceleration**: Hardware vs software rendering affects anti-aliasing
- **Browser versions**: Different browser versions may have rendering changes
- **Screen density**: Retina vs standard displays

For consistent baselines:
- Generate baselines in the same environment as CI (ubuntu-latest)
- Use the CI workflow's "Update Baselines" action for production baselines
- Document any known environment-specific differences

## CI Integration

The `visual-regression.yml` workflow:
- Runs on PRs touching `frontend/src/**`
- Compares snapshots in parallel across 3 browser projects
- Uploads diff reports as artifacts (retained 30 days)
- Blocks PR via the `Visual Regression Gate` job if diffs are detected
- Supports manual baseline regeneration via workflow dispatch

### CI Baseline Update

To update baselines via CI (no local Playwright install needed):
1. Go to **Actions → Visual Regression**
2. Click **Run workflow**, set `update_baselines` to `true`
3. The workflow regenerates snapshots and commits them back to the branch

## Troubleshooting

### Tests pass locally but fail in CI
- Ensure you're generating baselines on the same OS as CI (ubuntu-latest)
- Check for font rendering differences between macOS and Linux
- Use `npm run visual:update` in a CI-like environment

### Flaky snapshot tests
- Check that animations are properly disabled
- Ensure no async operations change the page after `waitForStable()`
- Verify no external resources (fonts, images) are loading inconsistently

### Large number of snapshot changes
- Review each change individually
- If changes are expected, batch them in a single commit
- If unexpected, investigate the root cause before updating
