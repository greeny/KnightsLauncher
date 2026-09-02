import {Injectable, isDevMode} from "@angular/core";
import {check, Update} from "@tauri-apps/plugin-updater";
import {relaunch} from "@tauri-apps/plugin-process";

import {DebugService} from "@src/app/debug/DebugService";

/**
 * Self-update via the Tauri updater plugin. The update manifest and signed
 * artifacts are hosted at knights-tavern.com/installers/launcher/ (endpoint
 * and public key configured in src-tauri/tauri.conf.json); CI builds,
 * signs and deploys them (.github/workflows/build.yml).
 */
@Injectable({providedIn: 'root'})
export class UpdateService
{
	public constructor(private _debugService: DebugService) {}

	/**
	 * Checks the update endpoint and returns the available update, or null
	 * when up to date. Never throws — dev builds and environments without
	 * the Tauri runtime just return null.
	 */
	public async checkForUpdate(): Promise<Update | null>
	{
		if (isDevMode()) {
			return null;
		}

		try {
			const update = await check();

			if (update) {
				this._debugService.log('update', `Update available: ${update.version} (current: ${update.currentVersion})`);
			} else {
				this._debugService.log('update', 'Launcher is up to date');
			}

			return update;
		} catch (error) {
			this._debugService.log('update', `Update check failed: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Downloads and installs the update, then relaunches the app. On Windows
	 * the installer exits the app itself, so the relaunch call may never be
	 * reached there. Progress is reported as downloaded/total bytes (total
	 * may be 0 when the server sends no length).
	 *
	 * Throws a descriptive Error when the download or installation fails.
	 */
	public async downloadAndInstall(update: Update, onProgress?: (downloaded: number, total: number) => void): Promise<void>
	{
		let downloaded = 0;
		let total = 0;

		try {
			await update.downloadAndInstall((event) =>
			{
				if (event.event === 'Started') {
					total = event.data.contentLength ?? 0;
					this._debugService.log('update', `Downloading update (${total} bytes)`);
				} else if (event.event === 'Progress') {
					downloaded += event.data.chunkLength;
					if (onProgress) {
						onProgress(downloaded, total);
					}
				} else if (event.event === 'Finished') {
					this._debugService.log('update', 'Download finished, installing');
				}
			});

			this._debugService.log('update', 'Update installed, relaunching');
			await relaunch();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._debugService.log('update', `Update failed: ${message}`);
			throw new Error(`Update failed: ${message}`);
		}
	}
}
