#!/usr/bin/env python3
"""Generate the public Soroban contract entrypoint reference from source.

Reads `stellar-contract/src/lib.rs` (the `#[contractimpl]` block) and
`stellar-contract/src/errors.rs` (the `Error` enum) and writes:

  * docs/sdk-api-reference.md  - consumer table between GENERATED markers
  * docs/CONTRACT_DOCUMENTATION.md - internal-only entrypoints between markers

Each entrypoint gets its arguments, return type, the parameters it authorises
with `require_auth`, and the `Error` variants its body returns directly.
Entrypoints whose doc comment says "internal" are kept out of the consumer
table. Those containing "deprecated" are marked as such.

Usage:
  python3 scripts/generate-contract-reference.py          # write the docs
  python3 scripts/generate-contract-reference.py --check  # exit 1 if docs are stale
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "stellar-contract/src/lib.rs"
ERRORS = ROOT / "stellar-contract/src/errors.rs"
CONSUMER_DOC = ROOT / "docs/sdk-api-reference.md"
INTERNAL_DOC = ROOT / "docs/CONTRACT_DOCUMENTATION.md"

CONSUMER_BEGIN = "<!-- BEGIN GENERATED: contract-entrypoints -->"
CONSUMER_END = "<!-- END GENERATED: contract-entrypoints -->"
INTERNAL_BEGIN = "<!-- BEGIN GENERATED: internal-entrypoints -->"
INTERNAL_END = "<!-- END GENERATED: internal-entrypoints -->"


def contractimpl_block(lines):
    """Return (start, end) line indices of the body of the #[contractimpl] impl block."""
    for i, line in enumerate(lines):
        if line.strip() == "#[contractimpl]":
            start = next(j for j in range(i, len(lines)) if lines[j].lstrip().startswith("impl "))
            depth = 0
            for j in range(start, len(lines)):
                depth += lines[j].count("{") - lines[j].count("}")
                if depth == 0 and j > start:
                    return start + 1, j
    raise SystemExit("contractimpl block not found in lib.rs")


def split_top_level(text):
    """Split a parameter list on commas that are not nested in <>, (), [] or {}."""
    parts, depth, cur = [], 0, ""
    for ch in text:
        if ch in "<([{":
            depth += 1
        elif ch in ">)]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def parse_signature(lines, i):
    """Read a `pub fn` signature that may span lines. Return (name, params, ret, next_index)."""
    sig = ""
    j = i
    while True:
        sig += lines[j].strip() + " "
        if "{" in lines[j] or lines[j].rstrip().endswith(";"):
            break
        j += 1
    m = re.match(r"pub fn (\w+)\s*\((.*?)\)\s*(?:->\s*(.*?))?\s*(?:where.*)?\{", sig)
    if not m:
        raise SystemExit(f"could not parse signature at lib.rs:{i + 1}: {sig}")
    name, raw_params, ret = m.group(1), m.group(2), (m.group(3) or "()").strip()
    params = []
    for p in split_top_level(raw_params):
        if ":" not in p:
            continue
        pname, ptype = p.split(":", 1)
        pname, ptype = pname.strip(), ptype.strip()
        params.append((pname, ptype))  # Env stays so call-site argument positions line up
    return name, params, ret, j


def doc_comment(lines, i):
    """Collect the `///` lines directly above the fn at index i, skipping attributes."""
    docs, j = [], i - 1
    while j >= 0 and (lines[j].strip().startswith("#[") or lines[j].strip().startswith("///")):
        if lines[j].strip().startswith("///"):
            docs.insert(0, lines[j].strip()[3:].strip())
        j -= 1
    return " ".join(d for d in docs if d)


def is_internal(docs):
    """An entrypoint is internal-only when its doc says so explicitly."""
    return bool(re.search(r"internal[- ]only|^internal\b|internal helper", docs.strip(), flags=re.I))


def helpers(lines, start, end):
    """Map every fn in the impl block to (params, body). Covers private helpers too."""
    table = {}
    i = start
    while i < end:
        m = re.match(r"\s*(?:pub )?fn (\w+)\s*\(", lines[i])
        if m:
            name, params, _, sig_end = parse_signature(lines, i) if lines[i].lstrip().startswith("pub fn ") else _private_sig(lines, i)
            table[name] = (params, body_text(lines, sig_end))
            i = sig_end + 1
        else:
            i += 1
    return table


def _private_sig(lines, i):
    """Signature parser for non-pub fns: same as parse_signature, with the pub prefix optional."""
    rewritten = list(lines)
    rewritten[i] = re.sub(r"^(\s*)fn ", r"\1pub fn ", lines[i], count=1)
    return parse_signature(rewritten, i)


def call_args(text, open_paren):
    """Return the raw argument strings of the call whose '(' is at open_paren."""
    depth, j = 0, open_paren
    while j < len(text):
        if text[j] == "(":
            depth += 1
        elif text[j] == ")":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return split_top_level(text[open_paren + 1 : j])


def trace(name, params, body, table, depth=0, seen=None):
    """Return (auth, errors) for an entrypoint, following Self:: helper calls.

    auth lists entrypoint parameters that the body or a helper it calls
    authorises with require_auth. errors lists Error variants reached.
    """
    seen = set() if seen is None else seen
    param_names = {p for p, _ in params}
    auth, errors = set(), set()
    if name in seen or depth > 6:
        return auth, errors
    seen = seen | {name}
    for ident in re.findall(r"(\w+)\.require_auth\(", body):
        if ident in param_names:
            auth.add(ident)
    errors.update(re.findall(r"Error::(\w+)", body))
    for m in re.finditer(r"Self::(\w+)\(", body):
        callee = m.group(1)
        if callee not in table:
            continue
        callee_params, callee_body = table[callee]
        args = call_args(body, m.end() - 1)
        sub_auth, sub_errors = trace(callee, callee_params, callee_body, table, depth + 1, seen)
        errors.update(sub_errors)
        for idx, (pname, _) in enumerate(callee_params):
            if pname not in sub_auth or idx >= len(args):
                continue
            expr = args[idx].replace("&", "").strip()
            if expr in param_names:
                auth.add(expr)
    return auth, errors


def body_text(lines, sig_end):
    """Return the source of the fn body starting from the line that opened it."""
    depth, out, started = 0, [], False
    for j in range(sig_end, len(lines)):
        line = lines[j]
        if not started and "{" not in line:
            continue
        started = True
        out.append(line)
        depth += line.count("{") - line.count("}")
        if depth == 0:
            break
    return "\n".join(out)


def error_codes():
    text = ERRORS.read_text()
    enum = text[text.index("pub enum Error"):]
    enum = enum[: enum.index("\n}")]
    return dict(re.findall(r"^\s+([A-Z]\w*)\s*=\s*(\d+),", enum, flags=re.M))


def entrypoints():
    lines = LIB.read_text().splitlines()
    start, end = contractimpl_block(lines)
    result = []
    i = start
    while i < end:
        if lines[i].lstrip().startswith("pub fn "):
            name, params, ret, sig_end = parse_signature(lines, i)
            body = body_text(lines, sig_end)
            docs = doc_comment(lines, i)
            auth, errors = trace(name, params, body, helpers(lines, start, end))
            auth, errors = sorted(auth), sorted(errors)
            result.append(
                {
                    "name": name,
                    "params": params,
                    "ret": ret,
                    "auth": auth,
                    "errors": errors,
                    "docs": docs,
                    "internal": is_internal(docs),
                    "deprecated": "deprecated" in docs.lower(),
                }
            )
            i = sig_end + 1
        else:
            i += 1
    return result


def fmt_params(params):
    shown = [(n, t) for n, t in params if t not in ("Env", "&Env")]
    return ", ".join(f"`{n}: {t}`" for n, t in shown) or "—"


def fmt_auth(auth):
    return ", ".join(f"`{a}`" for a in auth) or "none"


def fmt_errors(errors, codes):
    if not errors:
        return "—"
    return "<br>".join(f"`{e}` ({codes.get(e, '?')})" for e in errors)


def consumer_section(eps, codes):
    public = [e for e in eps if not e["internal"]]
    rows = ["| Entrypoint | Arguments | Returns | Requires auth | Errors | Status |",
            "|---|---|---|---|---|---|"]
    for e in public:
        status = "Deprecated" if e["deprecated"] else "Stable"
        rows.append(
            f"| `{e['name']}` | {fmt_params(e['params'])} | `{e['ret']}` | "
            f"{fmt_auth(e['auth'])} | {fmt_errors(e['errors'], codes)} | {status} |"
        )
    header = (
        f"Generated from `stellar-contract/src/lib.rs` and `stellar-contract/src/errors.rs`. "
        f"{len(public)} consumer-facing entrypoints. Entrypoints documented as internal are listed in "
        f"[CONTRACT_DOCUMENTATION.md](./CONTRACT_DOCUMENTATION.md). Do not edit this table by hand; "
        f"run `python3 scripts/generate-contract-reference.py`."
    )
    return "\n".join([CONSUMER_BEGIN, "", header, "", *rows, "", CONSUMER_END])


def internal_section(eps, codes):
    internal = [e for e in eps if e["internal"]]
    rows = ["| Entrypoint | Arguments | Returns | Requires auth | Errors | Note |",
            "|---|---|---|---|---|---|"]
    for e in internal:
        rows.append(
            f"| `{e['name']}` | {fmt_params(e['params'])} | `{e['ret']}` | "
            f"{fmt_auth(e['auth'])} | {fmt_errors(e['errors'], codes)} | {e['docs']} |"
        )
    header = (
        f"Generated from `stellar-contract/src/lib.rs`. {len(internal)} entrypoints are documented as "
        f"internal-only and are excluded from the consumer reference in "
        f"[sdk-api-reference.md](./sdk-api-reference.md). Do not edit this table by hand."
    )
    return "\n".join([INTERNAL_BEGIN, "", header, "", *rows, "", INTERNAL_END])


def replace_between(text, begin, end, body):
    if begin not in text or end not in text:
        raise SystemExit(f"markers {begin!r} / {end!r} missing")
    a = text.index(begin)
    b = text.index(end) + len(end)
    return text[:a] + body + text[b:]


def render():
    eps = entrypoints()
    codes = error_codes()
    consumer = replace_between(CONSUMER_DOC.read_text(), CONSUMER_BEGIN, CONSUMER_END,
                               consumer_section(eps, codes))
    internal = replace_between(INTERNAL_DOC.read_text(), INTERNAL_BEGIN, INTERNAL_END,
                               internal_section(eps, codes))
    return {CONSUMER_DOC: consumer, INTERNAL_DOC: internal}, eps


def main():
    outputs, eps = render()
    if "--check" in sys.argv:
        stale = [p.relative_to(ROOT) for p, text in outputs.items() if p.read_text() != text]
        if stale:
            print("STALE generated docs: " + ", ".join(map(str, stale)))
            print("Run: python3 scripts/generate-contract-reference.py")
            return 1
        print(f"Contract reference is up to date ({len(eps)} entrypoints).")
        return 0
    for path, text in outputs.items():
        path.write_text(text)
    public = sum(1 for e in eps if not e["internal"])
    print(f"Wrote {public} consumer entrypoints and {len(eps) - public} internal entrypoints.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
