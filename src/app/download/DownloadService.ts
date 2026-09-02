import {Injectable, NgZone} from "@angular/core";
import {firstValueFrom} from "rxjs";
import {download} from "@tauri-apps/plugin-upload";
import {invoke} from "@tauri-apps/api/core";
import {mkdir, remove} from "@tauri-apps/plugin-fs";
import {appDataDir, join} from "@tauri-apps/api/path";

import {GameVersionService} from "@src/app/api/GameVersionService";
import {ApiService} from "@src/app/api/ApiService";
import {StateService} from "@src/app/storage/StateService";
import {InstallationService} from "@src/app/installation/InstallationService";
import {DebugService} from "@src/app/debug/DebugService";
import {ApiResult} from "@src/app/api/model/ApiResult";
import {GameVersion} from "@src/app/api/model/GameVersion";
import {VersionInstaller} from "@src/app/api/model/VersionInstaller";

export interface DownloadProgress
{
	stage: 'downloading' | 'verifying' | 'installing';
	bytesDownloaded: number;
	totalBytes: number;
	percentComplete: number;
}

@Injectable({providedIn: 'root'})
export class DownloadService
{
	public constructor(
		private _gameVersionService: GameVersionService,
		private _apiService: ApiService,
		private _stateService: StateService,
		private _installationService: InstallationService,
		private _debugService: DebugService,
		private _ngZone: NgZone
	) {}

	/**
	 * Downloads a game version installer, verifies checksum, runs the
	 * installer (via installCommand, or the platform default when empty),
	 * records the version in state and cleans up the installer file.
	 *
	 * The download streams directly to disk (upload plugin) and the checksum
	 * is computed natively (sha256_file command), so installers of any size
	 * never pass through webview memory — buffering them there crashes the
	 * renderer process on files this large.
	 *
	 * A failed installation leaves nothing behind: the version is not
	 * recorded and the downloaded installer is removed.
	 *
	 * Emits progress updates during download.
	 * Throws descriptive Error on any failure.
	 */
	public async installVersion(
		version: GameVersion,
		installPath: string,
		name: string,
		installCommand: string,
		onProgress?: (progress: DownloadProgress) => void
	): Promise<void>
	{
		const result = await firstValueFrom(
			this._gameVersionService.getVersionInstaller(version.name)
		);
		const installer = result.data?.installer;

		if (!installer) {
			throw new Error(this.installerErrorMessage(result));
		}

		const dataDir = await appDataDir();
		try {
			// The download plugin creates the file but not the directory,
			// which does not exist yet on a fresh installation.
			await mkdir(dataDir, {recursive: true});
		} catch {
			// Already exists, or browser dev mode
		}

		const installerFilename = `KaM_Remake_install_${version.name}.exe`;
		const installerPath = await join(dataDir, installerFilename);

		await this.downloadToFile(installer, installerPath, onProgress);

		this.emitProgress(onProgress, 'verifying');

		if (installer.checksum) {
			try {
				await this.verifyChecksum(installerPath, installer.checksum);
			} catch (error) {
				await this.tryRemove(installerPath);
				throw error;
			}
		}

		this.emitProgress(onProgress, 'installing');

		try {
			await this._installationService.runInstaller(installerPath, installPath, installCommand);
		} catch (error) {
			await this.tryRemove(installerPath);
			throw new Error(`Installation failed: ${this.errorMessage(error)}`);
		}

		await this.tryRemove(installerPath);

		await this._stateService.addInstalledVersion({
			name: name,
			version: version.name,
			executablePath: await join(installPath, 'KaM_Remake.exe'),
			installedAt: new Date().toISOString(),
			order: 0,
			launchArgs: '',
		});
	}

	/** Streams the installer to disk, reporting download progress. */
	private async downloadToFile(
		installer: VersionInstaller,
		installerPath: string,
		onProgress?: (progress: DownloadProgress) => void
	): Promise<void>
	{
		this._debugService.log('download', `Downloading ${installer.url} to ${installerPath}`);

		// Progress callbacks arrive from Tauri outside the Angular zone, so
		// change detection must be re-entered explicitly — and throttled,
		// because the events fire for every received chunk.
		let lastEmit = 0;

		try {
			await download(installer.url, installerPath, (event) =>
			{
				const now = Date.now();
				if (!onProgress || now - lastEmit < 100) {
					return;
				}
				lastEmit = now;

				const totalBytes = event.total > 0 ? event.total : installer.size;
				this._ngZone.run(() => onProgress({
					stage: 'downloading',
					bytesDownloaded: event.progressTotal,
					totalBytes,
					percentComplete: totalBytes > 0 ? Math.round((event.progressTotal / totalBytes) * 100) : 0,
				}));
			});
		} catch (error) {
			this._debugService.log('download', `Download failed: ${this.errorMessage(error)}`);
			await this.tryRemove(installerPath);
			throw new Error(`Download failed: ${this.errorMessage(error)}`);
		}

		this._debugService.log('download', 'Download finished');
	}

	/** Verifies the file's SHA-256 (computed natively) against the expected hex checksum. */
	private async verifyChecksum(installerPath: string, expectedChecksum: string): Promise<void>
	{
		let calculatedChecksum: string;
		try {
			calculatedChecksum = await invoke<string>('sha256_file', {path: installerPath});
		} catch (error) {
			throw new Error(`Checksum calculation failed: ${this.errorMessage(error)}`);
		}

		this._debugService.log('download', `Checksum: expected ${expectedChecksum}, got ${calculatedChecksum}`);

		if (calculatedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
			throw new Error(
				`Checksum verification failed. Expected ${expectedChecksum}, got ${calculatedChecksum}.`
			);
		}
	}

	/** Maps the API's error keys (see launcher.md) to a user-facing message. */
	private installerErrorMessage(result: ApiResult<GameVersion>): string
	{
		if (result.errors.includes('installerNotAvailable')) {
			return 'The installer for this version is not available yet. Please try again later.';
		}

		if (result.errors.includes('versionNotFound')) {
			return 'This version no longer exists on the server.';
		}

		return `Could not retrieve download info. ${this._apiService.failureMessage(result)}`;
	}

	/** Removes a temporary file, ignoring cleanup errors. */
	private async tryRemove(path: string): Promise<void>
	{
		try {
			await remove(path);
		} catch {
			// Ignore cleanup errors
		}
	}

	private emitProgress(onProgress: ((progress: DownloadProgress) => void) | undefined, stage: DownloadProgress['stage']): void
	{
		if (onProgress) {
			onProgress({stage, bytesDownloaded: 0, totalBytes: 0, percentComplete: 0});
		}
	}

	private errorMessage(error: unknown): string
	{
		return error instanceof Error ? error.message : String(error);
	}
}
