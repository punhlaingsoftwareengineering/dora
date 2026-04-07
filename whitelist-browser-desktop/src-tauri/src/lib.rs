use serde::Serialize;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![get_device_spec])
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
