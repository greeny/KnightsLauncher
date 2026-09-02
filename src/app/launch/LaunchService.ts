import {Injectable} from "@angular/core";
import {Command} from "@tauri-apps/plugin-shell";
import {exists, mkdir, remove, writeTextFile} from "@tauri-apps/plugin-fs";
import {appDataDir, join} from "@tauri-apps/api/path";

import {DebugService} from "@src/app/debug/DebugService";
import {PlatformService} from "@src/app/platform/PlatformService";

/**
 * How long a spawned game process is watched for an early exit, in
 * milliseconds. If it dies with a non-zero exit code within this window the
 * launch is reported as failed, including any captured output. After the
 * window the game is assumed to be running fine.
 */
const EARLY_EXIT_WINDOW_MS = 3000;

/** Maximum number of captured output characters included in an error message. */
const ERROR_OUTPUT_LIMIT = 600;

/**
 * Delay between the process close event and evaluating the result, in
 * milliseconds, so trailing stdout/stderr events can still arrive.
 */
const OUTPUT_FLUSH_GRACE_MS = 50;

/** Outcome of watching a launched process for the early exit window. */
type LaunchExit =
	{type: 'exited'; code: number | null}
	| {type: 'error'; message: string}
	| {type: 'running'};

@Injectable({providedIn: 'root'})
export class LaunchService
{
	public constructor(
		private _debugService: DebugService,
		private _platformService: PlatformService
	) {}

	/**
	 * Spawns the game from the given executable path.
	 *
	 * The command always runs through a platform shell with cwd set to the
	 * game folder, because the shell resolves the executable name relative
	 * to that folder (a direct spawn on Windows would only search PATH and
	 * the launcher's own directory, not the cwd):
	 *   - Windows: `cmd /c <batch file containing the command>` — cmd cannot
	 *     receive the command as an argument, see writeLaunchBatch
	 *   - Linux/macOS: `sh -c "<command>"`
	 *
	 * If launchArgs is set, %exe% inside it is replaced with the executable
	 * basename and the result is used as the command. If it is empty the
	 * default is the basename alone on Windows, or `wine <basename>` on
	 * other platforms (the game is a Windows executable).
	 *
	 * The registered shell commands (sh, cmd) are declared in
	 * src-tauri/capabilities/default.json.
	 *
	 * Because the shell itself almost always spawns successfully even when
	 * the command inside it fails, the process is watched for a short early
	 * exit window; a quick death with a non-zero exit code is reported as an
	 * Error including the exit code and captured output. All launch activity
	 * is also logged to the DebugService.
	 *
	 * Throws a descriptive Error if the launch fails.
	 */
	public async launch(executablePath: string, launchArgs: string = ''): Promise<void>
	{
		const folderPath = this.getFolderPath(executablePath);
		const exeBasename = this.getBasename(executablePath);
		const isWindows = this._platformService.isWindows();

		await this.assertInstallationExists(executablePath, folderPath);
		let fullCommand;

		if (launchArgs.trim()) {
			fullCommand = launchArgs.replace('%exe%', exeBasename);
		} else if (isWindows) {
			fullCommand = exeBasename;
		} else {
			fullCommand = 'wine ' + exeBasename;
		}

		let command;
		let batchPath: string | null = null;

		if (isWindows) {
			// The command cannot be passed to `cmd /c` as an argument: the
			// process API escapes embedded quotes as \" which cmd does not
			// understand. A batch file is parsed by cmd natively instead. It
			// gets a unique name and is removed when the process closes,
			// because cmd keeps reading the file while the game runs.
			batchPath = await this.writeLaunchBatch(fullCommand);
			command = Command.create('cmd', ['/c', batchPath], {cwd: folderPath});
			this._debugService.log('launch', `Running: cmd /c ${batchPath} containing "${fullCommand}" (cwd: ${folderPath})`);
		} else {
			command = Command.create('sh', ['-c', fullCommand], {cwd: folderPath});
			this._debugService.log('launch', `Running: sh -c "${fullCommand}" (cwd: ${folderPath})`);
		}

		const outputLines: string[] = [];

		command.stdout.on('data', (line) => {
			outputLines.push(String(line));
			this._debugService.log('game stdout', String(line).trimEnd());
		});
		command.stderr.on('data', (line) => {
			outputLines.push(String(line));
			this._debugService.log('game stderr', String(line).trimEnd());
		});

		const exitPromise = new Promise<LaunchExit>((resolve) => {
			command.on('error', (error) => {
				this._debugService.log('launch', `Process error: ${String(error)}`);
				this.tryRemoveBatch(batchPath);
				setTimeout(() => resolve({type: 'error', message: String(error)}), OUTPUT_FLUSH_GRACE_MS);
			});
			command.on('close', (data) => {
				this._debugService.log('launch', `Process exited with code ${data.code}${data.signal !== null ? ` (signal ${data.signal})` : ''}`);
				this.tryRemoveBatch(batchPath);
				setTimeout(() => resolve({type: 'exited', code: data.code}), OUTPUT_FLUSH_GRACE_MS);
			});
		});

		let child;
		try {
			child = await command.spawn();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._debugService.log('launch', `Spawn failed: ${message}`);
			await this.tryRemoveBatch(batchPath);
			throw new Error(`Failed to launch game: ${message}`);
		}

		this._debugService.log('launch', `Process started (pid ${child.pid}), watching for early exit for ${EARLY_EXIT_WINDOW_MS} ms`);

		const result = await Promise.race([
			exitPromise,
			this.delay(EARLY_EXIT_WINDOW_MS).then((): LaunchExit => ({type: 'running'})),
		]);

		if (result.type === 'error') {
			throw new Error(`Failed to launch game: ${result.message}`);
		}

		if (result.type === 'exited' && result.code !== 0) {
			throw new Error(this.buildEarlyExitMessage(result.code, outputLines.join('')));
		}

		if (result.type === 'running') {
			this._debugService.log('launch', 'Process still running, launch considered successful');
		}
	}

	/**
	 * Verifies the game folder and executable still exist before launching,
	 * so the user gets a precise error instead of a cryptic shell failure.
	 * Skipped when the filesystem check itself is unavailable (browser dev
	 * mode) — the launch then fails through the normal path.
	 */
	private async assertInstallationExists(executablePath: string, folderPath: string): Promise<void>
	{
		let folderExists;
		let executableExists;

		try {
			folderExists = await exists(folderPath);
			executableExists = folderExists && await exists(executablePath);
		} catch (error) {
			this._debugService.log('launch', `Existence check unavailable, launching anyway: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}

		if (!folderExists) {
			this._debugService.log('launch', `Game folder missing: ${folderPath}`);
			throw new Error(`Game folder not found: ${folderPath}\nThe installation may have been moved or deleted. Edit this version and fix its executable path, or remove it from the list.`);
		}

		if (!executableExists) {
			this._debugService.log('launch', `Game executable missing: ${executablePath}`);
			throw new Error(`Game executable not found: ${executablePath}\nThe folder exists but the executable is missing. Edit this version and fix its executable path.`);
		}
	}

	/**
	 * Writes the launch command to a uniquely named batch file in the app
	 * data directory. chcp 65001 makes cmd read the UTF-8 file correctly
	 * even when paths contain non-ASCII characters.
	 */
	private async writeLaunchBatch(fullCommand: string): Promise<string>
	{
		const dataDir = await appDataDir();
		try {
			await mkdir(dataDir, {recursive: true});
		} catch {
			// Already exists
		}

		const batchPath = await join(dataDir, `knights-launcher-launch-${Date.now()}.bat`);
		await writeTextFile(batchPath, `@echo off\r\n@chcp 65001 >nul\r\n${fullCommand}\r\n`);
		return batchPath;
	}

	/** Removes a launch batch file, ignoring cleanup errors. */
	private async tryRemoveBatch(batchPath: string | null): Promise<void>
	{
		if (batchPath !== null) {
			try {
				await remove(batchPath);
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	private delay(ms: number): Promise<void>
	{
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private buildEarlyExitMessage(code: number | null, output: string): string
	{
		let message = `Game exited immediately with code ${code}.`;
		const trimmed = output.trim();

		if (trimmed) {
			const tail = trimmed.length > ERROR_OUTPUT_LIMIT
				? '…' + trimmed.substring(trimmed.length - ERROR_OUTPUT_LIMIT)
				: trimmed;
			message += '\n' + tail;
		} else {
			message += ' The game produced no output.';
		}

		return message;
	}

	/** Extract folder path from executable path (everything before last / or \). */
	private getFolderPath(executablePath: string): string
	{
		const i = Math.max(
			executablePath.lastIndexOf('/'),
			executablePath.lastIndexOf('\\')
		);
		return i >= 0 ? executablePath.substring(0, i) : executablePath;
	}

	/** Extract basename from path (everything after last / or \). */
	private getBasename(executablePath: string): string
	{
		const i = Math.max(
			executablePath.lastIndexOf('/'),
			executablePath.lastIndexOf('\\')
		);
		return i >= 0 ? executablePath.substring(i + 1) : executablePath;
	}
}
