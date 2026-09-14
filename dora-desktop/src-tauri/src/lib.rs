mod site_permissions;

use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::Manager;
use tauri::Url;
use tauri::WebviewUrl;
use tauri::WebviewWindow;
use tauri::WebviewWindowBuilder;
use tauri::webview::Color;
use tauri::webview::DownloadEvent;
use tauri::webview::NewWindowFeatures;
use tauri::webview::NewWindowResponse;

use site_permissions::attach_site_webview_permissions;

static BROWSER_LABEL_SEQ: AtomicU64 = AtomicU64::new(0);

// Runs in the main frame of every site window.
// - Forces normal link clicks to open a new window (handled by `on_new_window`), so the new window
//   keeps the same proxy configuration as sibling site windows.
// - Site windows use **native** decorations (`decorations(true)`), so the OS draws the title bar
//   outside the web content (draggable, does not cover fixed-position site UI).
// - Auto-recovers after sleep / long pauses by reloading when the app resumes.
const OPEN_LINKS_IN_NEW_WINDOW_SCRIPT: &str = r#"
(() => {
  if (window.__doraSiteWindowInitInstalled) return;
  window.__doraSiteWindowInitInstalled = true;

  function closestAnchor(el) {
    while (el && el !== document.documentElement) {
      if (el.tagName === 'A' && el.href) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener('click', (e) => {
    // Only handle normal left-clicks without modifiers.
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = closestAnchor(e.target);
    if (!a) return;
    const href = a.href;
    if (!href) return;

    // Only intercept http(s) navigations. Let mailto/tel/blob/data/etc behave normally.
    if (!(href.startsWith('http://') || href.startsWith('https://'))) return;

    // Allow explicit opt-out.
    if (a.hasAttribute('data-dora-same-window')) return;

    // Prevent in-window navigation; spawn a new window instead.
    e.preventDefault();
    try {
      window.open(href, '_blank');
    } catch {
      // ignore
    }
  }, true);

  function installResumeReload() {
    // Many web apps (e.g. WhatsApp Web) can lose real-time connection after sleep.
    // We detect long event-loop pauses and reload to re-establish sessions.
    let last = Date.now();
    setInterval(() => {
      const now = Date.now();
      const gapMs = now - last;
      last = now;
      if (gapMs > 120000) {
        try { window.location.reload(); } catch {}
      }
    }, 15000);

    window.addEventListener('online', () => {
      try { window.location.reload(); } catch {}
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Small defer lets WebView/network settle post-resume.
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 500);
      }
    });
  }

  function init() {
    try { installResumeReload(); } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
"#;

/// Soft Wash atmosphere on site windows: colors `html` only (not `body`), so opaque site UIs stay
/// intact while load flash, overscroll, and transparent pages pick up mineral paper + wash blobs.
/// Mode is substituted at window-open time from persisted chrome prefs.
fn wash_bleed_init_script(mode: &str) -> String {
  let dark = mode.eq_ignore_ascii_case("dark");
  // Mineral pigment tokens from menzies-design-wash-ui (light / dark).
  let (base, wash_a, wash_b, wash_c) = if dark {
    ("#12141a", "#1a3a48", "#3a3020", "#3a2826")
  } else {
    ("#f7f4ef", "#d9eef5", "#f2e1c6", "#e8c9c3")
  };
  format!(
    r#"
(() => {{
  if (window.__doraWashBleedInstalled) return;
  window.__doraWashBleedInstalled = true;
  const css = `
html {{
  background-color: {base} !important;
  background-image:
    radial-gradient(ellipse 80% 50% at 6% -5%, {wash_a}, transparent 58%),
    radial-gradient(ellipse 70% 45% at 96% 4%, {wash_b}, transparent 52%),
    radial-gradient(ellipse 55% 40% at 72% 100%, {wash_c}, transparent 58%) !important;
  background-attachment: fixed !important;
  min-height: 100%;
}}
`;
  function inject() {{
    if (document.querySelector('style[data-dora-wash-bleed]')) return;
    const el = document.createElement('style');
    el.setAttribute('data-dora-wash-bleed', '');
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }}
  if (document.documentElement) inject();
  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', inject, {{ once: true }});
  }} else {{
    inject();
  }}
}})();
"#,
    base = base,
    wash_a = wash_a,
    wash_b = wash_b,
    wash_c = wash_c
  )
}

fn wash_chrome_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("wash_chrome.json"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WashChrome {
  mode: String,
  #[serde(default = "default_wash_pigment")]
  pigment: String,
}

fn default_wash_pigment() -> String {
  "mineral".to_string()
}

impl Default for WashChrome {
  fn default() -> Self {
    Self {
      mode: "light".to_string(),
      pigment: default_wash_pigment(),
    }
  }
}

fn load_wash_chrome(app: &tauri::AppHandle) -> WashChrome {
  let Ok(path) = wash_chrome_path(app) else {
    return WashChrome::default();
  };
  let Ok(raw) = fs::read_to_string(path) else {
    return WashChrome::default();
  };
  serde_json::from_str(&raw).unwrap_or_default()
}

fn wash_background_color(chrome: &WashChrome) -> Color {
  if chrome.mode.eq_ignore_ascii_case("dark") {
    // mineral-dark --color-base-100
    Color(0x12, 0x14, 0x1a, 255)
  } else {
    // mineral light paper (base-200): warmer than stark white webview default
    Color(0xf7, 0xf4, 0xef, 255)
  }
}

#[tauri::command]
fn wb_set_wash_chrome(app: tauri::AppHandle, mode: String, pigment: String) -> Result<(), String> {
  let mode = if mode.eq_ignore_ascii_case("dark") {
    "dark"
  } else {
    "light"
  };
  let pigment = if pigment
    .chars()
    .all(|c| c.is_ascii_lowercase())
    && !pigment.is_empty()
  {
    pigment
  } else {
    default_wash_pigment()
  };
  let chrome = WashChrome {
    mode: mode.to_string(),
    pigment,
  };
  let path = wash_chrome_path(&app)?;
  let json = serde_json::to_string_pretty(&chrome).map_err(|e| e.to_string())?;
  fs::write(path, json).map_err(|e| e.to_string())
}

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

fn unique_browser_label() -> String {
  let n = BROWSER_LABEL_SEQ.fetch_add(1, Ordering::Relaxed);
  let mut x = n ^ 0x9E37_79B9_7F4A_7C15;
  let alpha = b"abcdefghijklmnopqrstuvwxyz";
  let mut s = String::from("browser-");
  for _ in 0..16 {
    x = x.wrapping_mul(6364136223846793005).wrapping_add(1);
    s.push(alpha[(x % 26) as usize] as char);
  }
  s
}

fn title_for_url(url: &Url) -> String {
  url
    .host_str()
    .map(|h| format!("{h} - Dora"))
    .unwrap_or_else(|| format!("{} - Dora", url.as_str()))
}

/// Strip wry's Downloads-folder uniqueness suffix (`name (1).ext` → `name.ext`).
///
/// wry builds collision names as `{base} ({n}){ext}` after splitting on the first `.`.
fn strip_trailing_paren_number(base: &str) -> Option<&str> {
  let open = base.rfind(" (")?;
  if !base.ends_with(')') {
    return None;
  }
  let num = &base[open + 2..base.len() - 1];
  if !num.is_empty() && num.bytes().all(|b| b.is_ascii_digit()) {
    Some(&base[..open])
  } else {
    None
  }
}

fn strip_download_collision_suffix(name: &str) -> String {
  if let Some((base, rest)) = name.split_once('.') {
    if let Some(clean) = strip_trailing_paren_number(base) {
      return format!("{clean}.{rest}");
    }
  } else if let Some(clean) = strip_trailing_paren_number(name) {
    return clean.to_string();
  }
  name.to_string()
}

fn url_path_basename(url: &Url) -> Option<String> {
  url
    .path_segments()
    .and_then(|mut segs| segs.next_back().filter(|s| !s.is_empty()).map(|s| s.to_string()))
}

fn is_generic_download_name(name: &str) -> bool {
  // Bare WebKit/route fallbacks with no extension (e.g. `/download` → `download`).
  // Keep names like `download.pdf` from Content-Disposition.
  if Path::new(name).extension().is_some() {
    return false;
  }
  matches!(
    name.to_ascii_lowercase().as_str(),
    "download" | "unknown" | "untitled"
  )
}

/// Default Save As name: wry/platform suggestion (Content-Disposition) → URL basename → `download`.
///
/// wry pre-fills `destination` as `~/Downloads/<suggested>` where `<suggested>` already comes from
/// WebKit / WKWebView / WebView2 (Content-Disposition when present). We only take the basename so
/// the dialog still lets the user pick a writable folder.
fn suggested_download_filename(url: &Url, destination: &Path) -> String {
  let from_dest = destination
    .file_name()
    .and_then(|n| n.to_str())
    .map(str::trim)
    .filter(|n| !n.is_empty() && *n != "." && *n != "..")
    .map(strip_download_collision_suffix);

  let from_url = url_path_basename(url);

  match (from_dest, from_url) {
    (Some(dest), Some(url_name))
      if is_generic_download_name(&dest) && !is_generic_download_name(&url_name) =>
    {
      url_name
    }
    (Some(dest), _) => dest,
    (None, Some(url_name)) => url_name,
    (None, None) => "download".to_string(),
  }
}

#[cfg(test)]
mod suggested_download_filename_tests {
  use super::*;
  use std::path::PathBuf;

  #[test]
  fn prefers_destination_basename_over_url() {
    let url = Url::parse("https://cdn.example/api/download").unwrap();
    let dest = PathBuf::from("/tmp/Downloads/invoice.pdf");
    assert_eq!(suggested_download_filename(&url, &dest), "invoice.pdf");
  }

  #[test]
  fn falls_back_to_url_basename() {
    let url = Url::parse("https://cdn.example/files/report.xlsx").unwrap();
    let dest = PathBuf::new();
    assert_eq!(suggested_download_filename(&url, &dest), "report.xlsx");
  }

  #[test]
  fn prefers_url_when_destination_is_generic_download() {
    let url = Url::parse("https://cdn.example/exports/q1-sales.csv").unwrap();
    let dest = PathBuf::from("/home/user/Downloads/download");
    assert_eq!(suggested_download_filename(&url, &dest), "q1-sales.csv");
  }

  #[test]
  fn strips_wry_collision_suffix() {
    let url = Url::parse("https://cdn.example/download").unwrap();
    let dest = PathBuf::from("/tmp/Downloads/photo (2).png");
    assert_eq!(suggested_download_filename(&url, &dest), "photo.png");
  }

  #[test]
  fn ultimate_fallback_is_download() {
    let url = Url::parse("https://cdn.example/").unwrap();
    let dest = PathBuf::new();
    assert_eq!(suggested_download_filename(&url, &dest), "download");
  }
}

fn stable_site_profile_key(url: &Url, proxy_url: &Option<String>) -> String {
  let host = url.host_str().unwrap_or("unknown-host");
  let scheme = url.scheme();
  let port = url.port_or_known_default().unwrap_or(0);

  let mut h = std::collections::hash_map::DefaultHasher::new();
  proxy_url.hash(&mut h);
  let proxy_hash = h.finish();

  let raw = format!("{scheme}-{host}-{port}-{proxy_hash:x}");
  raw
    .chars()
    .map(|c| match c {
      'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => c,
      _ => '-',
    })
    .collect()
}

/// Always show a native Save As dialog. Never accept wry's pre-filled `~/Downloads/...` path.
///
/// Returning `false` cancels the download (no file written). The chosen path must be absolute
/// (wry requirement).
fn prompt_download_destination(
  webview: &tauri::Webview<tauri::Wry>,
  url: &Url,
  destination: &mut PathBuf,
) -> bool {
  let name = suggested_download_filename(url, destination);
  let win = webview.window();
  match rfd::FileDialog::new()
    .set_parent(&win)
    .set_title("Save download")
    .set_file_name(&name)
    .save_file()
  {
    Some(path) if path.is_absolute() => {
      *destination = path;
      true
    }
    Some(path) => {
      // Relative paths are rejected: wry requires an absolute destination.
      log::warn!(
        "download Save As returned a non-absolute path ({}); cancelling",
        path.display()
      );
      false
    }
    None => false,
  }
}

/// Opens a dedicated site browsing window with proxy + `window.open` handling.
///
/// `allowed_patterns` is kept for IPC compatibility with the desktop client (same shapes as the
/// admin-managed site list) but is **not** applied inside webviews: blocking navigations by pattern
/// prevented CDN/blob downloads from completing on WebKitGTK.
fn open_site_webview_window(
  app: &tauri::AppHandle,
  label: String,
  parsed_url: Url,
  title: String,
  proxy_url: Option<String>,
  allowed_patterns: Vec<String>,
  opener_features: Option<NewWindowFeatures>,
) -> Result<WebviewWindow, String> {
  let wash = load_wash_chrome(app);
  let wash_bg = wash_background_color(&wash);

  let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed_url.clone()))
    .title(title)
    .inner_size(1100.0, 800.0)
    // Native title bar lives outside the webview: draggable on all platforms and does not
    // overlap fixed-position site chrome (unlike an HTML overlay + body padding).
    .decorations(true)
    .resizable(true)
    .visible(true)
    .focused(true)
    .enable_clipboard_access()
    .zoom_hotkeys_enabled(true)
    // Wash paper tone for load flash / overscroll / transparent pages (cross-platform).
    .background_color(wash_bg);

  #[cfg(windows)]
  {
    // Required so sites can use HTML5 drag-and-drop (file uploads, WhatsApp media, etc.).
    builder = builder.disable_drag_drop_handler();
  }

  builder = builder.on_download(|webview, event| {
    match event {
      DownloadEvent::Requested { url, destination } => {
        // Always prompt. Never return true with wry's default ~/Downloads path.
        // Cancel (false) writes nothing. Parent the dialog to this window for a reliable
        // modal picker on GTK/XDG (avoids silent portal failures).
        prompt_download_destination(&webview, &url, destination)
      }
      DownloadEvent::Finished {
        url,
        path,
        success,
      } => {
        if !success {
          log::warn!(
            "site window download failed (url={}, path={path:?})",
            url.as_str()
          );
        }
        true
      }
      _ => true,
    }
  });

  builder = builder.initialization_script(OPEN_LINKS_IN_NEW_WINDOW_SCRIPT);
  builder = builder.initialization_script(wash_bleed_init_script(&wash.mode));

  if let Some(features) = opener_features {
    builder = builder.window_features(features);
  }

  // Isolate site webviews from the main app WebContext on every OS.
  //
  // On Linux, WebKitGTK download handlers are registered on a shared WebContext keyed by
  // `data_directory`. Without a separate directory, the main window's wry default handler
  // (`|_, _| true`) auto-accepts to ~/Downloads and races the site Save As dialog.
  //
  // Stable per (origin-ish + proxy) so cookies/localStorage persist across restarts (same as
  // the prior Windows-only profile), instead of a random per-window label.
  {
    let profile_key = stable_site_profile_key(&parsed_url, &proxy_url);
    let dir = app
      .path()
      .app_local_data_dir()
      .map_err(|e| e.to_string())?
      .join("site-webviews")
      .join(profile_key);
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

  // Allow all navigations inside external site webviews. WebKitGTK applies this before the HTTP
  // response is known; strict URL-pattern blocking prevented CDN/blob/download URLs from loading,
  // so `on_download` never fired. Entry URLs are still gated in the desktop UI (`open()`).
  builder = builder.on_navigation(|_| true);

  let app_nw = app.clone();
  let proxy_nw = proxy_url.clone();
  let patterns_nw = allowed_patterns.clone();
  // Note: we intentionally do NOT enforce the allowlist on `on_new_window`. Many sites serve
  // downloads from a different host (CDN / file server). Child windows still inherit the relaxed
  // `on_navigation` policy above so those loads can complete and trigger downloads.
  builder = builder.on_new_window(move |url, features| {
    let new_label = unique_browser_label();
    let t = title_for_url(&url);
    match open_site_webview_window(
      &app_nw,
      new_label,
      url,
      t,
      proxy_nw.clone(),
      patterns_nw.clone(),
      Some(features),
    ) {
      Ok(w) => NewWindowResponse::Create { window: w },
      Err(e) => {
        log::warn!("site window (new-window): {e}");
        NewWindowResponse::Deny
      }
    }
  });

  builder = builder.on_document_title_changed(|window, doc_title| {
    let _ = window.set_title(&doc_title);
  });

  let window = builder.build().map_err(|e| e.to_string())?;
  // Auto-allow notifications + other web permissions for allowlisted site windows.
  attach_site_webview_permissions(&window);
  Ok(window)
}

/// Opens a dedicated site browsing window. On Windows this runs in an async command so WebView2
/// is not created from the same call stack as a UI event (see wry#583). Uses a per-origin
/// `data_directory` so site downloads and storage stay isolated from the main webview (and so
/// Linux WebKitGTK does not inherit wry's default auto-accept-to-Downloads handler).
#[tauri::command]
async fn wb_open_site_window(
  app: tauri::AppHandle,
  label: String,
  url: String,
  title: String,
  proxy_url: Option<String>,
  allowed_patterns: Option<Vec<String>>,
) -> Result<(), String> {
  let parsed_url: Url = url.parse().map_err(|e| format!("invalid url: {e}"))?;
  let patterns = allowed_patterns.unwrap_or_default();
  open_site_webview_window(
    &app,
    label,
    parsed_url,
    title,
    proxy_url,
    patterns,
    None,
  )?;
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
      wb_set_wash_chrome,
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

      // Build the main window from config with an explicit download handler.
      // wry's default (`|_, _| true`) would otherwise auto-write to ~/Downloads with no dialog.
      let conf = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or("missing main window config")?;
      WebviewWindowBuilder::from_config(app.handle(), &conf)?
        .on_download(|webview, event| match event {
          DownloadEvent::Requested { url, destination } => {
            prompt_download_destination(&webview, &url, destination)
          }
          DownloadEvent::Finished {
            url,
            path,
            success,
          } => {
            if !success {
              log::warn!(
                "main window download failed (url={}, path={path:?})",
                url.as_str()
              );
            }
            true
          }
          _ => true,
        })
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
