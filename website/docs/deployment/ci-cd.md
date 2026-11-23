---
id: ci-cd
title: CI/CD Pipeline
sidebar_position: 4
---

# Documentation Deployment Pipeline

The documentation website is automatically built and deployed via GitHub Actions on every push to `main` that modifies files in the `website/` directory.

## Deployment Targets

| Environment | Trigger           | URL                         |
| ----------- | ----------------- | --------------------------- |
| Preview     | PR opened/updated | PR comment with preview URL |
| Production  | Push to `main`    | https://docs.scavngr.io     |

## Pipeline Steps

```
Push to main
    ↓
Build (docusaurus build)
    ↓
Check for broken links
    ↓
Deploy to GitHub Pages
```

## GitHub Actions Workflow

The workflow is defined in `.github/workflows/docs.yml`:

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths: ['website/**', 'docs/**']
  pull_request:
    paths: ['website/**', 'docs/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: website/package-lock.json
      - run: npm ci
        working-directory: website
      - run: npm run build
        working-directory: website

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: website/package-lock.json
      - run: npm ci
        working-directory: website
      - run: npm run build
        working-directory: website
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website/build
```

## Local Development

```bash
cd website
npm install
npm start        # starts dev server at http://localhost:3000
npm run build    # production build
npm run serve    # serve the production build locally
```

## Adding Documentation

1. Create a new `.md` or `.mdx` file in `website/docs/`.
2. Add it to `website/sidebars.js` in the appropriate category.
3. Write your content using standard Markdown. MDX (React in Markdown) is also supported.
4. Open a PR — the CI pipeline will build and check for broken links.

## Style Guide

- Use sentence case for headings.
- Include code examples in fenced code blocks with a language tag.
- Link to related docs using relative paths (e.g., `[API Reference](/docs/api/overview)`).
- Keep pages focused — prefer multiple short pages over one long page.
- Add frontmatter `id`, `title`, and `sidebar_position` to every page.
