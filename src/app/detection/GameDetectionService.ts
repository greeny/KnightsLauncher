import {Injectable} from "@angular/core";
import {dirname} from "@tauri-apps/api/path";
import {exists, readFile} from "@tauri-apps/plugin-fs";

/** Regex to match version format: r followed by 4-5 digits. */
const VERSION_PATTERN = /r\d{4,5}/i;

@Injectable({providedIn: 'root'})
export class GameDetectionService
{
	/**
	 * Attempts to detect the game version from the executable's folder.
	 *
	 * Detection methods (in order):
	 * 1. Extract version from folder name (e.g. "/path/KaM_r10000/" → "r10000")
	 * 2. Read version from unins000.dat binary file (checks first 0x200 bytes for version string)
	 *
	 * Returns the detected version (e.g. "r12345") in lowercase, or "unknown" if not detected.
	 */
	public async detectVersion(executablePath: string): Promise<string>
	{
		try {
			const folderPath = await dirname(executablePath);

			// Try detection method 1: folder name
			const folderVersion = this.detectFromFolderName(folderPath);
			if (folderVersion) {
				return folderVersion;
			}

			// Try detection method 2: unins000.dat file
			const fileVersion = await this.detectFromUninstallerFile(folderPath);
			if (fileVersion) {
				return fileVersion;
			}
		} catch {
			// Silently ignore errors during detection
		}

		return 'unknown';
	}

	/** Extract version from folder path (e.g. "/path/KaM_r10000" → "r10000"). */
	private detectFromFolderName(folderPath: string): string | null
	{
		const parts = folderPath.split(/[\/\\]/);
		for (const part of parts) {
			const match = part.match(VERSION_PATTERN);
			if (match) {
				return match[0].toLowerCase();
			}
		}
		return null;
	}

	/** Try to extract version from unins000.dat binary file. */
	private async detectFromUninstallerFile(folderPath: string): Promise<string | null>
	{
		const uninsPath = folderPath + '/unins000.dat';

		try {
			if (!(await exists(uninsPath))) {
				return null;
			}

			const data = await readFile(uninsPath);
			// Check first 0x200 bytes for version string
			const slice = data.slice(0, 0x200);
			const text = new TextDecoder('utf-8', {fatal: false}).decode(slice);

			const match = text.match(VERSION_PATTERN);
			if (match) {
				return match[0].toLowerCase();
			}
		} catch {
			// Ignore errors reading file
		}

		return null;
	}
}
