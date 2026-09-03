import {Injectable} from "@angular/core";
import {readTextFile, remove} from "@tauri-apps/plugin-fs";
import {appDataDir, join} from "@tauri-apps/api/path";

import {DebugService} from "@src/app/debug/DebugService";
import {PlatformService} from "@src/app/platform/PlatformService";
import {ShellService} from "@src/app/platform/ShellService";

/** How often the installer's log file is re-read for progress, in milliseconds. */
const LOG_POLL_INTERVAL_MS = 250;

/** What the installer is currently doing, derived from its log file. */
export interface InstallerProgress
{
	/** Short user-facing description of the current step, e.g. "Installing KaM_Remake.exe". */
	step: string;
	/** Number of files the installer has written so far. */
	filesInstalled: number;
}

@Injectable({providedIn: 'root'})
export class InstallationService
{
	public constructor(
		private _debugService: DebugService,
		private _platformService: PlatformService,
		private _shellService: ShellService
	) {}

	/**
	 * Default install command for the current platform. %exe% is replaced
	 * with the installer file path and %args% with the default installer
	 * arguments (see getDefaultInstallArgs). On non-Windows the installer
	 * runs through wine.
	 */
	public getDefaultInstallCommand(): string
	{
		if (this._platformService.isWindows()) {
			return '"%exe%" %args%';
		}

		return 'wine "%exe%" %args%';
	}

	/**
	 * Inno Setup's silent-install parameters, with %dir% as the target
	 * directory and %log% as the log file the installer writes its progress
	 * to. On non-Windows the Z: prefix maps unix paths into wine's Z: drive
	 * (which is the unix filesystem root).
	 */
	private getDefaultInstallArgs(): string
	{
		const prefix = this._platformService.isWindows() ? '' : 'Z:';
		return `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="${prefix}%dir%" /LOG="${prefix}%log%" /NOICONS`;
	}

	/**
	 * Runs the installer and waits for it to finish.
	 *
	 * installCommand may use the %exe%, %dir% and %args% placeholders; when
	 * empty, the platform default from getDefaultInstallCommand() is used.
	 * The default installer arguments are always applied: they replace
	 * %args% when the command contains it, and are appended at the end
	 * otherwise — so a minimal command like "wine %exe%" still installs
	 * silently into the chosen directory.
	 *
	 * A silent Inno Setup installer prints nothing to stdout, so progress is
	 * read from the log file it writes when given /LOG: the file is polled
	 * while the installer runs and every "Dest filename:" line it gains is
	 * reported through onProgress.
	 *
	 * Throws when the installer cannot be started or exits non-zero.
	 */
	public async runInstaller(
		installerPath: string,
		installDirectory: string,
		installCommand: string = '',
		onProgress?: (progress: InstallerProgress) => void
	): Promise<void>
	{
		let template = installCommand.trim() || this.getDefaultInstallCommand();
		if (!template.includes('%args%')) {
			template += ' %args%';
		}

		const logPath = await join(await appDataDir(), 'knights-launcher-install.log');
		await this.tryRemove(logPath);

		// %args% first: it expands to text containing %dir% and %log%, which
		// the next replacements resolve.
		const fullCommand = template
			.replaceAll('%args%', this.getDefaultInstallArgs())
			.replaceAll('%exe%', installerPath)
			.replaceAll('%dir%', installDirectory)
			.replaceAll('%log%', logPath);

		const stopWatching = this.watchLog(logPath, onProgress);

		let result;
		try {
			result = await this._shellService.runAndWait(fullCommand, 'install');
		} catch (error) {
			throw new Error(`Failed to run installer: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			stopWatching();
			await this.logInstallerLog(logPath);
			await this.tryRemove(logPath);
		}

		if (result.code !== 0) {
			throw new Error(`Installer exited with code ${result.code}${result.stderr.trim() ? ': ' + result.stderr.trim() : ''}`);
		}
	}

	/**
	 * Polls the installer log and reports progress whenever it changes.
	 * Returns a function that stops the polling.
	 */
	private watchLog(logPath: string, onProgress?: (progress: InstallerProgress) => void): () => void
	{
		if (!onProgress) {
			return () => {};
		}

		onProgress({step: 'Starting the installer…', filesInstalled: 0});

		let lastStep = '';
		let reading = false;

		const timer = setInterval(async () => {
			if (reading) {
				return;
			}
			reading = true;

			try {
				const progress = this.parseLog(await readTextFile(logPath));
				if (progress && progress.step !== lastStep) {
					lastStep = progress.step;
					onProgress(progress);
				}
			} catch {
				// Log not created yet, or being written to
			} finally {
				reading = false;
			}
		}, LOG_POLL_INTERVAL_MS);

		return () => clearInterval(timer);
	}

	/**
	 * Turns the Inno Setup log into a progress description. Every installed
	 * file produces a "Dest filename: <path>" line; the last one is the file
	 * currently being written. Other well-known lines mark the phases before
	 * and after the file copy.
	 */
	private parseLog(log: string): InstallerProgress | null
	{
		if (!log.trim()) {
			return null;
		}

		let filesInstalled = 0;
		let currentFile: string | null = null;
		let phase = 'Preparing installation…';

		for (const line of log.split('\n')) {
			const destIndex = line.indexOf('Dest filename:');
			if (destIndex >= 0) {
				filesInstalled++;
				currentFile = this.basename(line.substring(destIndex + 'Dest filename:'.length).trim());
			} else if (line.includes('Installation process succeeded')) {
				phase = 'Finishing installation…';
				currentFile = null;
			} else if (line.includes('Creating directory:') || line.includes('Directory for uninstall files:')) {
				phase = 'Creating folders…';
			} else if (line.includes('Starting the installation process')) {
				phase = 'Installing…';
			}
		}

		const step = currentFile !== null ? `Installing ${currentFile}` : phase;
		return {step, filesInstalled};
	}

	/** Copies the installer log into the debug output so a failed install can be diagnosed. */
	private async logInstallerLog(logPath: string): Promise<void>
	{
		try {
			const log = (await readTextFile(logPath)).trim();
			if (log) {
				this._debugService.log('installer log', log);
			}
		} catch {
			// No log was written (installer never started or custom command without %args%)
		}
	}

	private basename(path: string): string
	{
		const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
		return i >= 0 ? path.substring(i + 1) : path;
	}

	private async tryRemove(path: string): Promise<void>
	{
		try {
			await remove(path);
		} catch {
			// Does not exist, or browser dev mode
		}
	}
}
