use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

fn app_device_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("device_storage.json"))
}

/// Older builds wrote here via `directories::ProjectDirs` (different from Tauri’s app data dir).
fn legacy_device_storage_path() -> Option<PathBuf> {
  directories::ProjectDirs::from("com", "punhlainghospital", "WhitelistBrowserDesktop")
    .map(|d| d.data_local_dir().join("device_storage.json"))
}

#[derive(Serialize)]
struct DeviceSpec {
  hostname: Option<String>,
  username: Option<String>,
  os: Option<String>,
  os_version: Option<String>,
  arch: Option<String>,
}

#[tauri::command]
fn get_device_spec() -> DeviceSpec {
  // Keep this minimal + cross-platform.
  let hostname = whoami::fallible::hostname().ok();
  let username = Some(whoami::username());
  let os = Some(whoami::platform().to_string());
  let os_version = None;
  let arch = Some(std::env::consts::ARCH.to_string());

  DeviceSpec {
    hostname,
    username,
    os,
    os_version,
    arch,
  }
}

#[tauri::command]
fn wb_storage_load(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let path = app_device_storage_path(&app)?;
  if path.exists() {
    return fs::read_to_string(&path).map(Some).map_err(|e| e.to_string());
  }
  if let Some(legacy) = legacy_device_storage_path() {
    if legacy.exists() {
      let data = fs::read_to_string(&legacy).map_err(|e| e.to_string())?;
      if let Err(e) = fs::write(&path, &data) {
        log::warn!("device_storage migrate: could not write {}: {e}", path.display());
      }
      return Ok(Some(data));
    }
  }
  Ok(None)
}

#[tauri::command]
fn wb_storage_save(app: tauri::AppHandle, json: String) -> Result<(), String> {
  let path = app_device_storage_path(&app)?;
  fs::write(path, json).map_err(|e| e.to_string())
}

/// Opens a dedicated site browsing window. On Windows this runs in an async command so WebView2
/// is not created from the same call stack as a UI event (see wry#583). Uses a per-window
/// `data_directory` so `proxy_url` does not share the main webview's user-data folder.
#[tauri::command]
async fn wb_open_site_window(
  app: tauri::AppHandle,
  label: String,
  url: String,
  title: String,
  proxy_url: Option<String>,
) -> Result<(), String> {
  let parsed_url: Url = url.parse().map_err(|e| format!("invalid url: {e}"))?;

  let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
    .title(title)
    .inner_size(1100.0, 800.0)
    .resizable(true)
    .visible(true)
    .focused(true);

  #[cfg(windows)]
  {
    let dir = app
      .path()
      .app_local_data_dir()
      .map_err(|e| e.to_string())?
      .join("site-webviews")
      .join(&label);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    builder = builder.data_directory(dir);
  }

  if let Some(ref p) = proxy_url {
    if !p.is_empty() {
      let u: Url = p
        .parse()
        .map_err(|e| format!("invalid proxy url: {e}"))?;
      builder = builder.proxy_url(u);
    }
  }

  builder.build().map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      get_device_spec,
      wb_storage_load,
      wb_storage_save,
      wb_open_site_window
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
