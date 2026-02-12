import {Injectable} from "@angular/core";
import {firstValueFrom} from "rxjs";
import {fetch as tauriFetch} from "@tauri-apps/plugin-http";
import {writeFile, remove} from "@tauri-apps/plugin-fs";
import {appDataDir, join} from "@tauri-apps/api/path";
import {family} from "@tauri-apps/plugin-os";

import {GameVersionService} from "@src/app/api/GameVersionService";
import {StateService} from "@src/app/storage/StateService";
import {InstallationService} from "@src/app/installation/InstallationService";
import {GameVersion} from "@src/app/api/model/GameVersion";

export interface DownloadProgress
{
	stage: 'downloading' | 'verifying' | 'writing' | 'installing';
	bytesDownloaded: number;
	totalBytes: number;
	percentComplete: number;
}

export interface InstallResult
{
	manualInstallPath: string | null;
}

@Injectable({providedIn: 'root'})
export class DownloadService
{
	public constructor(
		private _gameVersionService: GameVersionService,
		private _stateService: StateService,
		private _installationService: InstallationService
	) {}

	/**
	 * Downloads a game version installer, verifies checksum, and installs it.
	 *
	 * On Windows: Downloads, verifies, runs installer, records in state, cleans up file.
	 * On other OSes: Downloads file and returns path for manual installation.
	 *
	 * Emits progress updates during download.
	 * Throws descriptive Error on any failure.
	 */
	public async installVersion(
		version: GameVersion,
		installPath: string,
		name: string,
		onProgress?: (progress: DownloadProgress) => void
	): Promise<InstallResult>
	{
		const downloadInfo = await firstValueFrom(
			this._gameVersionService.getVersionDownload(version.name)
		);

		if (!downloadInfo) {
			throw new Error('Could not retrieve download info. Check your internet connection.');
		}

		const installerData = await this.downloadWithProgress(downloadInfo.url, onProgress);

		this.emitProgress(onProgress, 'verifying');
		await this.yieldToUI();

		if (downloadInfo.checksum) {
			await this.verifyChecksum(installerData, downloadInfo.checksum);
		}

		// Write installer to appDataDir (within Tauri's allowed FS scope)
		const installerFilename = `KaM_Remake_install_${version.name}.exe`;
		const tempDir = await appDataDir();
		const installerPath = await join(tempDir, installerFilename);

		this.emitProgress(onProgress, 'writing');
		await this.yieldToUI();

		try {
			await writeFile(installerPath, installerData);
		} catch (error) {
			throw new Error(`Failed to write installer to disk: ${this.errorMessage(error)}`);
		}

		if (family() !== 'windows') {
			return {manualInstallPath: installerPath};
		}

		this.emitProgress(onProgress, 'installing');
		await this.yieldToUI();

		try {
			await this._installationService.runInstaller(installerPath, installPath);
		} catch (error) {
			throw new Error(`Installation failed: ${this.errorMessage(error)}`);
		}

		try {
			await remove(installerPath);
		} catch {
			// Ignore cleanup errors
		}

		await this._stateService.addInstalledVersion({
			name: name,
			version: version.name,
			executablePath: await join(installPath, 'KaM_Remake.exe'),
			installedAt: new Date().toISOString(),
			order: 0,
			launchArgs: '',
		});

		return {manualInstallPath: null};
	}

	private async downloadWithProgress(
		url: string,
		onProgress?: (progress: DownloadProgress) => void
	): Promise<Uint8Array>
	{
		let response: Response;
		try {
			response = await tauriFetch(url);
		} catch (error) {
			throw new Error(`Download failed: ${this.errorMessage(error)}`);
		}

		if (!response.ok) {
			throw new Error(`Download failed: server returned HTTP ${response.status}.`);
		}

		const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
		const reader = response.body?.getReader();

		if (!reader) {
			throw new Error('Failed to read download stream.');
		}

		const chunks: Uint8Array[] = [];
		let bytesDownloaded = 0;

		try {
			while (true) {
				const {done, value} = await reader.read();
				if (done) {
					break;
				}

				chunks.push(value);
				bytesDownloaded += value.length;

				if (onProgress) {
					onProgress({
						stage: 'downloading',
						bytesDownloaded,
						totalBytes,
						percentComplete: totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
					});
				}
			}
		} catch (error) {
			throw new Error(`Download interrupted: ${this.errorMessage(error)}`);
		}

		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;

		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}

		return result;
	}

	private async verifyChecksum(data: Uint8Array, expectedChecksum: string): Promise<void>
	{
		let calculatedChecksum: string;
		try {
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		} catch (error) {
			throw new Error(`Checksum calculation failed: ${this.errorMessage(error)}`);
		}

		if (calculatedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
			throw new Error(
				`Checksum verification failed. Expected ${expectedChecksum}, got ${calculatedChecksum}.`
			);
		}
	}

	private emitProgress(onProgress: ((progress: DownloadProgress) => void) | undefined, stage: DownloadProgress['stage']): void
	{
		if (onProgress) {
			onProgress({stage, bytesDownloaded: 0, totalBytes: 0, percentComplete: 0});
		}
	}

	private yieldToUI(): Promise<void>
	{
		return new Promise(resolve => setTimeout(resolve, 0));
	}

	private errorMessage(error: unknown): string
	{
		return error instanceof Error ? error.message : String(error);
	}
}
