#[cfg(desktop)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            #[cfg(desktop)]
            {
                let window = _app.get_webview_window("main").expect("main window");
                std::thread::spawn(move || {
                    for _ in 0..50 {
                        if window.is_visible().unwrap_or(false) {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    let win = window.clone();
                    let _ = window.run_on_main_thread(move || {
                        let _ = win.set_decorations(false);
                    });
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}