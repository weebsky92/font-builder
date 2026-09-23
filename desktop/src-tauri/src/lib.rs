use serde_json::Value;
use std::process::Command;
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
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid engine JSON: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_engine])
        .run(tauri::generate_context!())
        .expect("error while running app");
}
