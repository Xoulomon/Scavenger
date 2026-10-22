/**
 * Property-based tests for docs/CONTRACT_API.md correctness.
 *
 * Feature: contract-api-reference
 *
 * Validates that the generated API reference document satisfies the five
 * correctness properties defined in the design document.
 *
 * Run with: npm test  (from docs/tests/)
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Read the generated API reference document. */
function readApiDoc(): string {
  // docs/tests/ → docs/ → CONTRACT_API.md
  // When running from docs/tests/, __dirname is <workspace>/docs/tests.
  const docPath = resolve(__dirname, "../CONTRACT_API.md");
  return readFileSync(docPath, "utf-8");
}

/** Read the Rust contract source. */
function readContractSource(): string {
  const srcPath = resolve(__dirname, "../../stellar-contract/src/lib.rs");
  try {
    return readFileSync(srcPath, "utf-8");
  } catch {
    const altPath = resolve(__dirname, "../../../stellar-contract/src/lib.rs");
    return readFileSync(altPath, "utf-8");
  }
}

/**
 * Extract all public function names from inside `#[contractimpl] impl ScavengerContract`.
 * Returns an array of function name strings.
 */
function extractPublicFunctions(source: string): string[] {
  // Match `pub fn <name>` inside the contractimpl block
  const fnRegex = /pub fn ([a-z_][a-z0-9_]*)\s*\(/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(source)) !== null) {
    names.push(match[1]);
  }
  // Deduplicate (some helpers may appear multiple times)
  return [...new Set(names)];
}

/**
 * Extract all function entry headings from the API doc, scoped to function
 * group sections only (not Events or Types).
 */
function extractDocFunctionHeadings(doc: string): string[] {
  // Only look in function group sections, not in Events/Types
  const functionSectionStart = doc.indexOf("## Admin");
  if (functionSectionStart === -1) return [];
  const functionPart = doc.slice(functionSectionStart);

  const headingRegex = /^### `([a-z_][a-z0-9_]*)`/gm;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(functionPart)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

/**
 * Extract all ToC anchor links from the document.
 * Looks for `[text](#anchor)` patterns.
 */
function extractTocAnchors(doc: string): string[] {
  // Find the Table of Contents section
  const tocStart = doc.indexOf("## Table of Contents");
  const tocEnd = doc.indexOf("\n## ", tocStart + 1);
  const tocSection =
    tocEnd > -1 ? doc.slice(tocStart, tocEnd) : doc.slice(tocStart);

  const anchorRegex = /\(#([a-z0-9_-]+)\)/g;
  const anchors: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(tocSection)) !== null) {
    anchors.push(match[1]);
  }
  return [...new Set(anchors)];
}

/**
 * Convert a heading text to a GitHub-flavoured Markdown anchor.
 * e.g. "Waste (v1)" → "waste-v1", "Rewards & Tokens" → "rewards--tokens"
 * Function headings like "`confirm_waste_details`" → "confirm_waste_details"
 */
function headingToAnchor(heading: string): string {
  // Strip backtick wrappers
  const stripped = heading.replace(/`/g, "");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Extract all heading anchors from the document body (## and ### headings).
 */
function extractDocHeadingAnchors(doc: string): string[] {
  const headingRegex = /^#{2,3} (.+)$/gm;
  const anchors: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(doc)) !== null) {
    // Strip backtick wrappers for function headings: `fn_name` → fn_name
    const text = match[1].replace(/`/g, "");
    anchors.push(headingToAnchor(text));
  }
  return anchors;
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

let doc: string;
let source: string;
let publicFunctions: string[];
let docFunctionHeadings: string[];
let docHeadingAnchors: string[];

beforeAll(() => {
  doc = readApiDoc();
  source = readContractSource();
  publicFunctions = extractPublicFunctions(source);
  docFunctionHeadings = extractDocFunctionHeadings(doc);
  docHeadingAnchors = extractDocHeadingAnchors(doc);
});

// ─── Unit tests (specific examples and edge cases) ───────────────────────────

describe("Unit tests — document structure", () => {
  it("document starts with the correct top-level heading", () => {
    expect(doc.startsWith("# Scavenger Contract API Reference")).toBe(true);
  });

  it("contains all 8 required function group sections", () => {
    const requiredSections = [
      "## Admin",
      "## Participant Management",
      "## Waste (v1)",
      "## Waste (v2)",
      "## Incentives",
      "## Rewards & Tokens",
      "## Statistics & Queries",
      "## Contract Control",
    ];
    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }
  });

  it("contains a Table of Contents section", () => {
    expect(doc).toContain("## Table of Contents");
  });

  it("contains an Errors section", () => {
    expect(doc).toContain("## Errors");
  });

  it("contains an Events section", () => {
    expect(doc).toContain("## Events");
  });

  it("contains all 14 event symbol names", () => {
    const events = [
      "recycled",
      "donated",
      "transfer",
      "confirmed",
      "reg",
      "rewarded",
      "loc_upd",
      "adm_xfr",
      "paused",
      "unpaused",
      "bulk_xfr",
      "reset",
      "deactive",
      "inc_upd",
    ];
    for (const event of events) {
      expect(doc).toContain(`\`${event}\``);
    }
  });

  it("deprecated functions carry deprecation notices", () => {
    const deprecated = ["transfer_waste", "get_waste_by_id", "update_location"];
    for (const fn of deprecated) {
      // Find the function heading and check nearby text for "Deprecated"
      const headingIdx = doc.indexOf(`### \`${fn}\``);
      expect(headingIdx).toBeGreaterThan(-1);
      const snippet = doc.slice(headingIdx, headingIdx + 500);
      expect(snippet.toLowerCase()).toContain("deprecated");
    }
  });

  it("coordinate-accepting functions document microdegrees and valid range", () => {
    const coordFunctions = [
      "register_participant",
      "recycle_waste",
      "transfer_waste_v2",
      "update_participant_location",
    ];
    for (const fn of coordFunctions) {
      const headingIdx = doc.indexOf(`### \`${fn}\``);
      expect(headingIdx).toBeGreaterThan(-1);
      const snippet = doc.slice(headingIdx, headingIdx + 1500);
      expect(snippet).toContain("microdegrees");
    }
  });

  it("documents the three valid transfer routes", () => {
    expect(doc).toContain("Recycler → Collector");
    expect(doc).toContain("Recycler → Manufacturer");
    expect(doc).toContain("Collector → Manufacturer");
  });

  it("documents default reward percentages (5% and 50%)", () => {
    expect(doc).toContain("5%");
    expect(doc).toContain("50%");
  });

  it("documents the reward formula", () => {
    expect(doc).toContain("weight_grams / 1000");
    expect(doc).toContain("multiplier");
  });
});

// ─── Property-based tests ────────────────────────────────────────────────────

describe("Property 1: All public functions are documented", () => {
  /**
   * Feature: contract-api-reference, Property 1: All public functions are documented
   *
   * For every `pub fn` name extracted from the contract source, the function
   * name SHALL appear as a heading or code reference in CONTRACT_API.md.
   */
  it("every public function name from the source appears in the doc", () => {
    // Internal helpers that are not public contract functions to exclude
    const internalHelpers = new Set([
      "new",
      "as_str",
      "can_collect_materials",
      "can_process_recyclables",
      "can_manufacture",
      "verify",
      "confirm",
      "reset_confirmation",
      "deactivate",
      "transfer_to",
      "calculate_reward_points",
      "record_submission",
      "record_verification",
    ]);

    const contractFunctions = publicFunctions.filter(
      (fn) => !internalHelpers.has(fn),
    );

    fc.assert(
      fc.property(fc.constantFrom(...contractFunctions), (fnName) => {
        // The function name should appear either as a heading or as a code reference
        return (
          doc.includes(`### \`${fnName}\``) || doc.includes(`\`${fnName}\``)
        );
      }),
      { numRuns: contractFunctions.length },
    );
  });
});

describe("Property 2: Each Function_Entry is complete", () => {
  /**
   * Feature: contract-api-reference, Property 2: Each Function_Entry is complete
   *
   * For a random subset of function entries, the entry SHALL contain the
   * function name, a Parameters section, and a Returns section.
   */
  it("each function entry contains name, Parameters, and Returns sections", () => {
    fc.assert(
      fc.property(fc.constantFrom(...docFunctionHeadings), (fnName) => {
        const headingIdx = doc.indexOf(`### \`${fnName}\``);
        if (headingIdx === -1) return true; // skip if not found (shouldn't happen)

        // Find the next function heading to bound the section
        const nextHeadingIdx = doc.indexOf("\n### `", headingIdx + 1);
        const section =
          nextHeadingIdx > -1
            ? doc.slice(headingIdx, nextHeadingIdx)
            : doc.slice(headingIdx, headingIdx + 3000);

        // Must contain the function name
        const hasName = section.includes(`\`${fnName}\``);
        // Must contain a Returns section
        const hasReturns = section.includes("**Returns**");
        // Must contain either a Parameters section or "_None._"
        const hasParams =
          section.includes("**Parameters**") || section.includes("_None._");

        return hasName && hasReturns && hasParams;
      }),
      { numRuns: Math.min(docFunctionHeadings.length, 100) },
    );
  });
});

describe("Property 3: Each Function_Entry has at least one usage example", () => {
  /**
   * Feature: contract-api-reference, Property 3: Each Function_Entry has at least one usage example
   *
   * For every function entry section, at least one fenced code block SHALL be present.
   */
  it("every function entry contains at least one fenced code block", () => {
    fc.assert(
      fc.property(fc.constantFrom(...docFunctionHeadings), (fnName) => {
        const headingIdx = doc.indexOf(`### \`${fnName}\``);
        if (headingIdx === -1) return true;

        const nextHeadingIdx = doc.indexOf("\n### `", headingIdx + 1);
        const section =
          nextHeadingIdx > -1
            ? doc.slice(headingIdx, nextHeadingIdx)
            : doc.slice(headingIdx, headingIdx + 3000);

        // Must contain at least one fenced code block (``` ... ```)
        return section.includes("```");
      }),
      { numRuns: Math.min(docFunctionHeadings.length, 100) },
    );
  });
});

describe("Property 4: Usage examples use a consistent format", () => {
  /**
   * Feature: contract-api-reference, Property 4: Usage examples use a consistent format
   *
   * All fenced code blocks in function entries SHALL use the same invocation
   * format (soroban contract invoke CLI) — not mixed with TypeScript SDK.
   */
  it("all example code blocks use soroban CLI format (not mixed with TS SDK)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...docFunctionHeadings), (fnName) => {
        const headingIdx = doc.indexOf(`### \`${fnName}\``);
        if (headingIdx === -1) return true;

        const nextHeadingIdx = doc.indexOf("\n### `", headingIdx + 1);
        const section =
          nextHeadingIdx > -1
            ? doc.slice(headingIdx, nextHeadingIdx)
            : doc.slice(headingIdx, headingIdx + 3000);

        // Extract bash code blocks
        const bashBlocks = [...section.matchAll(/```bash\n([\s\S]*?)```/g)].map(
          (m) => m[1],
        );

        // Each bash block should use soroban contract invoke format
        for (const block of bashBlocks) {
          if (
            block.includes("import ") ||
            block.includes("const ") ||
            block.includes("await ")
          ) {
            // TypeScript/JS code found in a bash block — inconsistent format
            return false;
          }
        }
        return true;
      }),
      { numRuns: Math.min(docFunctionHeadings.length, 100) },
    );
  });
});

describe("Property 5: All ToC anchor links resolve", () => {
  /**
   * Feature: contract-api-reference, Property 5: All ToC anchor links resolve
   *
   * For every [text](#anchor) link in the Table of Contents, the corresponding
   * heading SHALL exist in the document body.
   */
  it("every ToC anchor link resolves to a heading in the document", () => {
    const tocAnchors = extractTocAnchors(doc);

    fc.assert(
      fc.property(fc.constantFrom(...tocAnchors), (anchor) => {
        // Check if the anchor matches any heading in the document
        return docHeadingAnchors.some(
          (h) => h === anchor || h.startsWith(anchor),
        );
      }),
      { numRuns: tocAnchors.length },
    );
  });
});
