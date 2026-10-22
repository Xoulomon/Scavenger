use std::path::Path;

#[test]
fn validation_uses_only_the_directory_module_layout() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");

    assert!(
        !source.join("validation.rs").exists(),
        "remove src/validation.rs; validation must use src/validation/mod.rs"
    );
    assert!(
        source.join("validation").join("mod.rs").is_file(),
        "src/validation/mod.rs must exist"
    );

    for module in ["addresses.rs", "amounts.rs", "weights.rs", "paths.rs"] {
        assert!(
            source.join("validation").join(module).is_file(),
            "src/validation/{module} must exist"
        );
    }
}
