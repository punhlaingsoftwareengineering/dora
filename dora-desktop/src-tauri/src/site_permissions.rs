//! Auto-allow web permission prompts for org allowlisted site windows.
//!
//! Dora only opens approved sites; we grant webview-level capabilities those sites need
//! (notifications, media, geolocation, etc.) instead of showing deny/prompt dialogs.
//! This does **not** weaken URL/navigation policy or download Save As.

use tauri::WebviewWindow;

/// Attach platform permission / capability handlers to a site [`WebviewWindow`].
///
/// Call after the window is built. Failures are logged and non-fatal so a site can still open.
pub fn attach_site_webview_permissions(window: &WebviewWindow) {
  if let Err(e) = window.with_webview(|platform| {
    attach_platform_permissions(platform);
  }) {
    log::warn!(
      "site window permissions: with_webview failed (label={}): {e}",
      window.label()
    );
  }
}

#[cfg(any(
  target_os = "linux",
  target_os = "dragonfly",
  target_os = "freebsd",
  target_os = "netbsd",
  target_os = "openbsd"
))]
fn attach_platform_permissions(platform: tauri::webview::PlatformWebview) {
  use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

  let webview = platform.inner();

  // WebKitGTK: notifications, geolocation, user-media (mic/camera), pointer lock,
  // device-info, media-key-system, website-data-access, install-missing-media-plugins, etc.
  webview.connect_permission_request(|_wv, request| {
    request.allow();
    // true = request handled (do not fall through to WebKit's default deny/prompt path).
    true
  });

  // Extra media / realtime capabilities beyond wry defaults (webgl/webaudio/clipboard).
  if let Some(settings) = WebViewExt::settings(&webview) {
    settings.set_enable_media(true);
    settings.set_enable_media_capabilities(true);
    settings.set_enable_media_stream(true);
    settings.set_enable_mediasource(true);
    settings.set_enable_webrtc(true);
    settings.set_enable_encrypted_media(true);
    settings.set_enable_fullscreen(true);
    settings.set_javascript_can_access_clipboard(true);
  }
}

#[cfg(windows)]
fn attach_platform_permissions(platform: tauri::webview::PlatformWebview) {
  use webview2_com::{
    Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    PermissionRequestedEventHandler,
  };

  unsafe {
    let controller = platform.controller();
    let Ok(webview) = controller.CoreWebView2() else {
      log::warn!("site window permissions: CoreWebView2 unavailable");
      return;
    };

    // wry already registers a clipboard-only handler when clipboard access is enabled.
    // A second handler can still SetState(ALLOW) for every other kind (notifications,
    // camera, microphone, geolocation, etc.).
    let mut token = 0i64;
    if let Err(e) = webview.add_PermissionRequested(
      &PermissionRequestedEventHandler::create(Box::new(|_, args| {
        let Some(args) = args else {
          return Ok(());
        };
        args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
        Ok(())
      })),
      &mut token,
    ) {
      log::warn!("site window permissions: PermissionRequested failed: {e}");
    }
  }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
fn attach_platform_permissions(_platform: tauri::webview::PlatformWebview) {
  // wry already auto-grants WKWebView media-capture via the UI delegate.
  // There is no stable WKUIDelegate hook in wry 0.54 for Notification.requestPermission;
  // web notifications still need the Dora app to be allowed in macOS System Settings >
  // Notifications. Other PermissionRequested-style APIs are not exposed here yet
  // (upstream wry/tauri permission-handler PRs land in newer versions).
}

#[cfg(not(any(
  target_os = "linux",
  target_os = "dragonfly",
  target_os = "freebsd",
  target_os = "netbsd",
  target_os = "openbsd",
  windows,
  target_os = "macos",
  target_os = "ios"
)))]
fn attach_platform_permissions(_platform: tauri::webview::PlatformWebview) {}
