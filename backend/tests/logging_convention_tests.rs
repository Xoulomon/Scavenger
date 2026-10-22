//! Guards the logging convention from `docs/LOGGING_CONVENTION.md` (issue #1479):
//! library code under `backend/src` must emit events through `tracing`, not
//! through `println!`, `eprintln!` or `dbg!`.
//!
//! Binary entrypoints (`main.rs`) are allowed to write to stdio, and comment
//! lines are ignored so doc examples do not trip the check.

use std::fs;
use std::path::{Path, PathBuf};

const FORBIDDEN_MACROS: [&str; 3] = ["println!", "eprintln!", "dbg!"];

fn collect_rs_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = fs::read_dir(dir).expect("source directory is readable");
    for entry in entries {
        let path = entry.expect("directory entry is readable").path();
        if path.is_dir() {
            collect_rs_files(&path, out);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            out.push(path);
        }
    }
}

fn is_code_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    !trimmed.starts_with("//")
}

#[test]
fn backend_library_code_has_no_stdout_or_debug_macros() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    collect_rs_files(&src, &mut files);
    assert!(!files.is_empty(), "expected Rust sources under {}", src.display());

    let mut violations = Vec::new();
    for file in files {
        if file.file_name().is_some_and(|name| name == "main.rs") {
            continue;
        }
        let content = fs::read_to_string(&file).expect("source file is readable as UTF-8");
        for (index, line) in content.lines().enumerate() {
            if !is_code_line(line) {
                continue;
            }
            for macro_name in FORBIDDEN_MACROS {
                if line.contains(macro_name) {
                    violations.push(format!("{}:{}: {}", file.display(), index + 1, line.trim()));
                }
            }
        }
    }

    assert!(
        violations.is_empty(),
        "found stdout/debug macros; use tracing::{{info,warn,error}} instead:\n{}",
        violations.join("\n")
    );
}
