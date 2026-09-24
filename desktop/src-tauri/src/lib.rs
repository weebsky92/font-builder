use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
    WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct DesktopSettings {
    close_to_tray: bool,
    launch_at_startup: bool,
    clean_temp_on_start: bool,
    build_mode: String,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            launch_at_startup: false,
            clean_temp_on_start: true,
            build_mode: "auto".into(),
        }
    }
}

struct SettingsState(Mutex<DesktopSettings>);

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

fn temp_root() -> PathBuf {
    std::env::temp_dir().join("font-builder")
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

fn load_settings(app: &tauri::AppHandle) -> DesktopSettings {
    let Ok(path) = settings_path(app) else {
        return DesktopSettings::default();
    };

    let Ok(raw) = fs::read_to_string(path) else {
        return DesktopSettings::default();
    };

    serde_json::from_str(&raw).unwrap_or_default()
}

fn persist_settings(app: &tauri::AppHandle, settings: &DesktopSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

fn apply_autostart(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();

    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

fn clean_temp() {
    let root = temp_root();

    if root.exists() {
        let _ = fs::remove_dir_all(&root);
    }

    let _ = fs::create_dir_all(root);
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

#[tauri::command]
fn get_desktop_settings(state: tauri::State<'_, SettingsState>) -> DesktopSettings {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn set_desktop_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, SettingsState>,
    mut settings: DesktopSettings,
) -> Result<DesktopSettings, String> {
    if !matches!(
        settings.build_mode.as_str(),
        "auto" | "true-variable" | "discrete-variable"
    ) {
        settings.build_mode = "auto".into();
    }

    apply_autostart(&app, settings.launch_at_startup)?;
    persist_settings(&app, &settings)?;

    let mut guard = state.0.lock().unwrap();
    *guard = settings.clone();

    Ok(settings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let settings = load_settings(app.handle());

            if settings.clean_temp_on_start {
                clean_temp();
            }

            let _ = apply_autostart(app.handle(), settings.launch_at_startup);

            app.manage(SettingsState(Mutex::new(settings)));

            let show = MenuItem::with_id(app, "show", "Show Font Builder", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Font Builder")
                .show_menu_on_left_click(true);

            if let Some(icon) = app.default_window_icon() {
                tray.icon(icon.clone())
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            } else {
                tray.on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<SettingsState>();
                let close_to_tray = state
                    .0
                    .lock()
                    .map(|settings| settings.close_to_tray)
                    .unwrap_or(false);

                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            run_engine,
            create_build_dir,
            copy_output_file,
            get_desktop_settings,
            set_desktop_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running app");
}
