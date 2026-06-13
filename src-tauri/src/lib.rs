pub mod relay;

/// Démarre le relais multijoueur embarqué (hôte uniquement) et renvoie son port.
#[tauri::command]
fn ensure_relay() -> Result<u16, String> {
    relay::ensure_relay(8787)
}

/// Adresses IPv4 LAN de l'hôte, à communiquer à l'invité.
#[tauri::command]
fn lan_addresses() -> Vec<String> {
    relay::lan_addresses()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    .invoke_handler(tauri::generate_handler![ensure_relay, lan_addresses])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
