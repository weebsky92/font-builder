use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

fn engine_command(app: &tauri::AppHandle) -> Result<(String, Vec<String>), String> {
    if let Ok(dev) = std::env::var("FONTBUILDER_ENGINE_DEV") {
        return Ok((dev, vec![]));
    }

    let resource = app.path().resource_dir().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let exe = resource.join("engine").join("fontbuilder-engine.exe");

    #[cfg(not(target_os = "windows"))]
    let exe = resource.join("engine").join("fontbuilder-engine");

    Ok((exe.to_string_lossy().to_string(), vec![]))
}

#[tauri::command]
fn run_engine(app: tauri::AppHandle, args: Vec<String>) -> Result<Value, String> {
    let (program, prefix) = engine_command(&app)?;

    let output = Command::new(&program)
        .args(prefix)
        .args(args)
        .output()
        .map_err(|e| format!("Cannot start engine {}: {}", program, e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid engine JSON: {}", e))
}

fn temp_root() -> PathBuf {
    std::env::temp_dir().join("font-builder")
}

#[tauri::command]
fn create_build_dir() -> Result<String, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let dir = temp_root().join(format!("build-{}-{}", std::process::id(), stamp));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_output_file(source: String, destination: String) -> Result<(), String> {
    let src = fs::canonicalize(&source).map_err(|e| e.to_string())?;
    let allowed_root = temp_root();

    let allowed = fs::canonicalize(&allowed_root).unwrap_or(allowed_root);

    if !src.starts_with(&allowed) {
        return Err("Refusing to copy a file outside Font Builder temporary output.".into());
    }

    let dest = PathBuf::from(destination);

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            run_engine,
            create_build_dir,
            copy_output_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running app");
}
