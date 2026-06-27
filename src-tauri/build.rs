fn main() {
    let target = std::env::var("TARGET").unwrap();
    println!("cargo:rustc-env=TARGET={}", target);
    tauri_build::build();
}
