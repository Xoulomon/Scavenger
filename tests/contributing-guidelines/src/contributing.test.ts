// =============================================================================
// PURPOSE: This file is a CONTRIBUTING.md compliance test fixture.
//
// This standalone Vitest project exists solely to verify that
// /workspaces/Scavenger/CONTRIBUTING.md contains all required sections,
// conventions, and wording mandated by the project's contribution guidelines.
//
// This test fixture is located in tests/contributing-guidelines/ for clarity
// and to avoid confusion with the main frontend application (which lives at
// frontend/ in the project root).
//
// To run these tests:
//   cd tests/contributing-guidelines && npm test
// =============================================================================

/// <reference types="vitest" />
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 4.1 - File-reading helper
const contributingMd = fs.readFileSync(
  path.resolve(__dirname, "../../../CONTRIBUTING.md"),
  "utf-8",
);

// Feature: contributing-guidelines, Property 1: code style tooling references are present
// Validates: Requirements 1.1, 1.2, 1.3
describe("Property 1: code style tooling references are present", () => {
  it("contains cargo fmt", () => {
    expect(contributingMd).toContain("cargo fmt");
  });
  it("contains cargo clippy", () => {
    expect(contributingMd).toContain("cargo clippy");
  });
  it("contains prettier", () => {
    expect(contributingMd).toContain("prettier");
  });
  it("contains eslint", () => {
    expect(contributingMd).toContain("eslint");
  });
});

// Feature: contributing-guidelines, Property 2: naming conventions and function length guideline are present
// Validates: Requirements 1.4, 1.5
describe("Property 2: naming conventions and function length guideline are present", () => {
  it("contains snake_case", () => {
    expect(contributingMd).toContain("snake_case");
  });
  it("contains PascalCase", () => {
    expect(contributingMd).toContain("PascalCase");
  });
  it("contains 50-line guideline", () => {
    expect(contributingMd).toContain("50");
  });
});

// Feature: contributing-guidelines, Property 3: PR process section contains all required workflow elements
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
describe("Property 3: PR process section contains all required workflow elements", () => {
  it("contains feature/ branch prefix", () => {
    expect(contributingMd).toContain("feature/");
  });
  it("contains fix/ branch prefix", () => {
    expect(contributingMd).toContain("fix/");
  });
  it("contains docs/ branch prefix", () => {
    expect(contributingMd).toContain("docs/");
  });
  it("contains maintainer approval requirement", () => {
    expect(contributingMd.toLowerCase()).toContain("maintainer");
  });
  it("contains CI checks requirement", () => {
    expect(contributingMd).toContain("CI");
  });
  it("contains one concern per PR instruction", () => {
    expect(contributingMd.toLowerCase()).toContain("one concern");
  });
});

// Feature: contributing-guidelines, Property 4: testing section contains all required testing guidance
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
describe("Property 4: testing section contains all required testing guidance", () => {
  it("contains Soroban test framework reference", () => {
    expect(contributingMd.toLowerCase()).toContain("soroban test framework");
  });
  it("contains cargo test command", () => {
    expect(contributingMd).toContain("cargo test");
  });
  it("contains npm test command", () => {
    expect(contributingMd).toContain("npm test");
  });
  it("contains coverage requirement", () => {
    expect(contributingMd.toLowerCase()).toContain("coverage");
  });
  it("contains new public API test requirement", () => {
    expect(contributingMd.toLowerCase()).toContain("new public");
  });
});

// Feature: contributing-guidelines, Property 5: commit conventions section contains all required format elements
// Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
describe("Property 5: commit conventions section contains all required format elements", () => {
  it("contains the Conventional Commits format string", () => {
    expect(contributingMd).toContain("<type>(<scope>)");
  });
  it("contains all seven commit types", () => {
    for (const type of [
      "feat",
      "fix",
      "docs",
      "chore",
      "refactor",
      "test",
      "style",
    ]) {
      expect(contributingMd).toContain(type);
    }
  });
  it("contains all four valid scopes", () => {
    for (const scope of ["contract", "frontend", "scripts", "docs"]) {
      expect(contributingMd).toContain(scope);
    }
  });
  it("contains 72-character limit", () => {
    expect(contributingMd).toContain("72");
  });
  it("contains imperative mood requirement", () => {
    expect(contributingMd.toLowerCase()).toContain("imperative");
  });
  it("contains blank line rule", () => {
    expect(contributingMd.toLowerCase()).toContain("blank line");
  });
  it("contains Closes # syntax", () => {
    expect(contributingMd).toContain("Closes #");
  });
});

// Feature: contributing-guidelines, Property 6: code of conduct section contains all required community standards
// Validates: Requirements 5.1, 5.2, 5.3, 5.4
describe("Property 6: code of conduct section contains all required community standards", () => {
  it("contains Contributor Covenant reference", () => {
    expect(contributingMd).toContain("Contributor Covenant");
  });
  it("contains a contact method", () => {
    expect(contributingMd).toContain("conduct@");
  });
  it("contains exclusion statement", () => {
    expect(contributingMd.toLowerCase()).toContain("exclusion");
  });
  it("contains inclusivity affirmation", () => {
    expect(contributingMd.toLowerCase()).toContain("regardless");
  });
});

// Feature: contributing-guidelines, Property 7: setup section contains all required prerequisites and commands
// Validates: Requirements 6.1, 6.2, 6.3, 6.4
describe("Property 7: setup section contains all required prerequisites and commands", () => {
  it("contains Rust toolchain (rustup)", () => {
    expect(contributingMd).toContain("rustup");
  });
  it("contains Soroban CLI reference", () => {
    expect(contributingMd).toContain("soroban-cli");
  });
  it("contains Node.js reference", () => {
    expect(contributingMd).toContain("Node.js");
  });
  it("contains npm install command", () => {
    expect(contributingMd).toContain("npm install");
  });
  it("contains git clone command", () => {
    expect(contributingMd).toContain("git clone");
  });
  it("references README.md", () => {
    expect(contributingMd).toContain("README.md");
  });
  it("references QUICKSTART.txt", () => {
    expect(contributingMd).toContain("QUICKSTART.txt");
  });
  it("references PROJECT_SETUP.txt", () => {
    expect(contributingMd).toContain("PROJECT_SETUP.txt");
  });
});
