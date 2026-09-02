use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};

/// Computes the SHA-256 of a file as a lowercase hex string, streaming so
/// large installers never have to fit into (webview) memory.
#[tauri::command]
pub fn sha256_file(path: String) -> Result<String, String>
{
	let file = File::open(&path).map_err(|error| error.to_string())?;
	let mut reader = BufReader::new(file);
	let mut hasher = Sha256::new();
	let mut buffer = [0u8; 65536];

	loop {
		let read = reader.read(&mut buffer).map_err(|error| error.to_string())?;
		if read == 0 {
			break;
		}
		hasher.update(&buffer[..read]);
	}

	Ok(format!("{:x}", hasher.finalize()))
}
