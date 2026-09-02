mod hash;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run()
{
	tauri::Builder::default()
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_dialog::init())
		.plugin(tauri_plugin_os::init())
		.plugin(tauri_plugin_updater::Builder::new().build())
		.plugin(tauri_plugin_process::init())
		.plugin(tauri_plugin_upload::init())
		.invoke_handler(tauri::generate_handler![hash::sha256_file])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
