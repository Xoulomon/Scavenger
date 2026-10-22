use std::collections::HashSet;
use std::fs;
use std::path::Path;

const DOMAINS: [&str; 7] = [
    "admin",
    "analytics",
    "incentive",
    "participant",
    "transfer",
    "verification",
    "waste",
];

fn normalized_signatures(source: &str) -> Vec<String> {
    let mut signatures = Vec::new();
    let mut current = None::<String>;

    for line in source.lines() {
        let trimmed = line.trim();
        if current.is_none() && trimmed.starts_with("pub fn ") {
            current = Some(String::new());
        }

        if let Some(signature) = current.as_mut() {
            signature.push_str(trimmed);
            signature.push(' ');
            if let Some((header, _)) = signature.split_once('{') {
                signatures.push(
                    header
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ")
                        .replace("( ", "(")
                        .replace(", )", ")")
                        .replace(" )", ")"),
                );
                current = None;
            }
        }
    }

    signatures
}

#[test]
fn contract_entrypoint_signatures_match_the_original_snapshot() {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    let source = fs::read_to_string(manifest.join("src/lib.rs")).unwrap();
    let expected = include_str!("snapshots/contract_entrypoint_signatures.txt")
        .lines()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let actual = normalized_signatures(&source);

    assert_eq!(actual.len(), 216, "unexpected contract entrypoint count");
    assert_eq!(actual, expected, "contract entrypoint signatures changed");
}

#[test]
fn entrypoints_live_in_domain_modules_and_lib_remains_thin() {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    let lib = fs::read_to_string(manifest.join("src/lib.rs")).unwrap();
    assert!(lib.lines().count() < 800, "lib.rs has {} lines", lib.lines().count());
    assert_eq!(lib.matches("#[contractimpl]").count(), 1);

    let expected = normalized_signatures(&lib)
        .iter()
        .map(|signature| {
            signature
                .strip_prefix("pub fn ")
                .unwrap()
                .split('(')
                .next()
                .unwrap()
                .to_owned()
        })
        .collect::<HashSet<_>>();
    let mut actual = HashSet::new();
    let mut entrypoint_count = 0;

    for domain in DOMAINS {
        let source = fs::read_to_string(manifest.join(format!("src/contract_domains/{domain}.rs"))).unwrap();
        assert!(!source.contains("#[contractimpl]"));

        for line in source.lines() {
            let Some(declaration) = line.trim().strip_prefix("pub(crate) fn ") else {
                continue;
            };
            let name = declaration.split('(').next().unwrap().to_owned();
            assert!(actual.insert(name.clone()), "duplicate domain function: {name}");
            entrypoint_count += 1;
        }
    }

    assert_eq!(entrypoint_count, 216);
    assert_eq!(actual, expected, "domain functions do not match contract shims");
}
