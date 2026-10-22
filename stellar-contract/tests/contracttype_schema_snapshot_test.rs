use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

fn module_sources() -> Vec<PathBuf> {
    let src = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    [
        "types.rs",
        "types_domains/analytics.rs",
        "types_domains/compliance.rs",
        "types_domains/engagement.rs",
        "types_domains/incentives.rs",
        "types_domains/marketplace.rs",
        "types_domains/participants.rs",
        "types_domains/permissions.rs",
        "types_domains/transfers.rs",
        "types_domains/waste.rs",
    ]
    .iter()
    .map(|path| src.join(path))
    .collect()
}

fn type_layouts(source: &str) -> Vec<(String, String)> {
    let lines: Vec<_> = source.lines().collect();
    let mut layouts = Vec::new();
    let mut index = 0;

    while index < lines.len() {
        let kind = match lines[index].trim() {
            "#[contracttype]" => "STRUCT_OR_ENUM",
            "#[contracterror]" => "ERROR",
            _ => {
                index += 1;
                continue;
            }
        };

        let mut declaration_index = index + 1;
        while declaration_index < lines.len()
            && !lines[declaration_index].trim_start().starts_with("pub struct ")
            && !lines[declaration_index].trim_start().starts_with("pub enum ")
        {
            declaration_index += 1;
        }
        assert!(
            declaration_index < lines.len(),
            "contract type attribute has no struct or enum declaration"
        );

        let declaration = lines[declaration_index].trim();
        let (declaration_kind, name) = if let Some(name) = declaration.strip_prefix("pub struct ") {
            ("STRUCT", name.split_whitespace().next().unwrap())
        } else if let Some(name) = declaration.strip_prefix("pub enum ") {
            ("ENUM", name.split_whitespace().next().unwrap())
        } else {
            unreachable!()
        };
        let name = name.trim_end_matches('{').to_owned();
        let mut body = Vec::new();
        let mut depth = 0_i32;
        let mut opened = false;
        let mut end = declaration_index;

        for (line_index, line) in lines.iter().enumerate().skip(declaration_index) {
            for character in line.chars() {
                match character {
                    '{' => {
                        depth += 1;
                        opened = true;
                    }
                    '}' => depth -= 1,
                    _ => {}
                }
            }
            if opened {
                body.push(*line);
            }
            end = line_index;
            if opened && depth == 0 {
                break;
            }
        }
        assert!(opened && depth == 0, "unclosed contract type {name}");

        let members = if declaration_kind == "STRUCT" {
            body.iter()
                .filter_map(|line| {
                    let member = line.trim().strip_prefix("pub ")?;
                    let (name, _) = member.split_once(':')?;
                    let name = name.trim();
                    (!name.is_empty()).then_some(name)
                })
                .collect::<Vec<_>>()
                .join(",")
        } else {
            body.iter()
                .filter_map(|line| {
                    let line = line.trim();
                    if line.starts_with("///") || line.starts_with("//") || line.starts_with('#') {
                        return None;
                    }
                    let variant = line
                        .split(|character: char| character.is_whitespace() || character == '=' || character == ',')
                        .next()?;
                    variant
                        .chars()
                        .next()
                        .filter(|character| character.is_ascii_uppercase())
                        .map(|_| variant)
                })
                .collect::<Vec<_>>()
                .join(",")
        };

        layouts.push((name.clone(), format!("{kind}|{declaration_kind}|{name}|{members}")));
        index = end + 1;
    }

    layouts
}

#[test]
fn contracttype_xdr_schema_matches_the_field_order_snapshot() {
    let mut layouts = BTreeMap::new();
    let mut definitions = BTreeMap::<(String, String), usize>::new();

    for path in module_sources() {
        let source = fs::read_to_string(&path).expect("read type module");
        for (name, layout) in type_layouts(&source) {
            let kind = layout.split('|').next().unwrap().to_owned();
            *definitions.entry((kind, name.clone())).or_default() += 1;
            if layout.starts_with("STRUCT_OR_ENUM|") {
                layouts.insert(name, layout.strip_prefix("STRUCT_OR_ENUM|").unwrap().to_owned());
            }
        }
    }

    for ((kind, name), count) in definitions {
        assert_eq!(count, 1, "{kind} {name} must have one canonical definition");
    }

    let snapshot_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("snapshots")
        .join("contracttype_xdr_schema.txt");
    let expected: Vec<_> = fs::read_to_string(snapshot_path)
        .expect("read contract type schema snapshot")
        .lines()
        .map(str::to_owned)
        .collect();
    let actual: Vec<_> = layouts.into_values().collect();

    assert_eq!(
        actual, expected,
        "contract type field or variant order changed; review XDR compatibility before updating the snapshot"
    );
}
