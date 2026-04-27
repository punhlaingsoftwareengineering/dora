use regex::Regex;
use serde::Serialize;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::Manager;
use tauri::Url;
use tauri::WebviewUrl;
use tauri::WebviewWindow;
use tauri::WebviewWindowBuilder;
use tauri::webview::NewWindowFeatures;
use tauri::webview::NewWindowResponse;

static BROWSER_LABEL_SEQ: AtomicU64 = AtomicU64::new(0);

// Runs in the main frame of every site window.
// - Forces normal link clicks to open a new window (handled by `on_new_window`), so the new window
//   keeps the same proxy + allowlist policy.
// - Adds a small always-available refresh control.
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

  function installRefreshButton() {
    if (document.getElementById('__dora_refresh_btn')) return;
    const btn = document.createElement('button');
    btn.id = '__dora_refresh_btn';
    btn.type = 'button';
    btn.textContent = 'Refresh';
    btn.setAttribute('aria-label', 'Refresh');
    btn.style.position = 'fixed';
    btn.style.right = '12px';
    btn.style.bottom = '12px';
    btn.style.zIndex = '2147483647';
    btn.style.padding = '8px 10px';
    btn.style.borderRadius = '999px';
    btn.style.border = '1px solid rgba(0,0,0,0.15)';
    btn.style.background = 'rgba(255,255,255,0.92)';
    btn.style.color = '#111';
    btn.style.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      try { window.location.reload(); } catch {}
    });
    (document.body || document.documentElement).appendChild(btn);
  }

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
    try { installRefreshButton(); } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
"#;

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

fn regex_special(c: char) -> bool {
  matches!(
    c,
    '.' | '+' | '?' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\'
  )
}

/// Match URL against an admin pattern using `*` wildcards (same rules as desktop `allowlist.ts`).
fn url_matches_pattern(url: &str, pattern: &str) -> bool {
  let mut escaped = String::with_capacity(pattern.len() * 2);
  for c in pattern.chars() {
    if c == '*' {
      escaped.push_str(".*");
    } else if regex_special(c) {
      escaped.push('\\');
      escaped.push(c);
    } else {
      escaped.push(c);
    }
  }
  let Ok(re) = Regex::new(&format!("^{escaped}$")) else {
    return false;
  };
  re.is_match(url)
}

fn url_matches_any(url: &str, patterns: &[String]) -> bool {
  if patterns.is_empty() {
    return true;
  }
  patterns.iter().any(|p| url_matches_pattern(url, p))
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

/// Opens a dedicated site browsing window with allowlist + proxy, and handles `window.open` / `target=_blank`
/// by spawning additional windows with the same policy.
fn open_site_webview_window(
  app: &tauri::AppHandle,
  label: String,
  parsed_url: Url,
  title: String,
  proxy_url: Option<String>,
  patterns: Vec<String>,
  opener_features: Option<NewWindowFeatures>,
) -> Result<WebviewWindow, String> {
  let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed_url.clone()))
    .title(title)
    .inner_size(1100.0, 800.0)
    .resizable(true)
    .visible(true)
    .focused(true);

  builder = builder.initialization_script(OPEN_LINKS_IN_NEW_WINDOW_SCRIPT);

  if let Some(features) = opener_features {
    builder = builder.window_features(features);
  }

  #[cfg(windows)]
  {
    // IMPORTANT: WebView2 persistence is tied to its user-data directory.
    // If we create a unique `data_directory` per window label (random each run),
    // cookies/localStorage will never persist across app restarts.
    //
    // We still want to isolate site browsing webviews from the main app webview (proxy, etc),
    // so we use a stable directory per (origin-ish + proxy) instead.
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

  let patterns_nav = patterns.clone();
  builder = builder.on_navigation(move |url| url_matches_any(url.as_str(), &patterns_nav));

  let app_nw = app.clone();
  let proxy_nw = proxy_url.clone();
  let patterns_nw = patterns.clone();
  builder = builder.on_new_window(move |url, features| {
    if !url_matches_any(url.as_str(), &patterns_nw) {
      return NewWindowResponse::Deny;
    }
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

  builder.build().map_err(|e| e.to_string())
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
