import {Injectable} from "@angular/core";
import {Command} from "@tauri-apps/plugin-shell";
import {mkdir, remove, writeTextFile} from "@tauri-apps/plugin-fs";
import {appDataDir, join} from "@tauri-apps/api/path";

import {DebugService} from "@src/app/debug/DebugService";
import {PlatformService} from "@src/app/platform/PlatformService";

/** Result of a shell command that ran to completion. */
export interface ShellResult
{
	code: number | null;
	stdout: string;
	stderr: string;
}

/**
 * Runs a full command line through the platform shell and waits for it to
 * finish. Used for one-shot tools such as installers and uninstallers; the
 * game itself is launched by LaunchService, which watches a long-running
 * process instead.
 *
 *   - Windows: `cmd /c <batch file containing the command>`. The command
 *     cannot be passed to `cmd /c` as an argument: the process API escapes
 *     embedded quotes as \" which cmd does not understand. A batch file is
 *     parsed by cmd natively instead. chcp 65001 makes cmd read the UTF-8
 *     file correctly even when paths contain non-ASCII characters.
 *   - Linux/macOS: `sh -c "<command>"`.
 *
 * Both shells are registered in src-tauri/capabilities/default.json.
 */
@Injectable({providedIn: 'root'})
export class ShellService
{
	public constructor(
		private _debugService: DebugService,
		private _platformService: PlatformService
	) {}

	/**
	 * Runs the command and resolves with its exit code and captured output.
	 * Throws when the shell itself could not be started.
	 */
	public async runAndWait(fullCommand: string, source: string, cwd?: string): Promise<ShellResult>
	{
		const isWindows = this._platformService.isWindows();
		let command;
		let batchPath: string | null = null;

		if (isWindows) {
			batchPath = await this.writeBatch(fullCommand, source);
			command = Command.create('cmd', ['/c', batchPath], cwd ? {cwd} : undefined);
			this._debugService.log(source, `Running: cmd /c ${batchPath} containing "${fullCommand}"${cwd ? ` (cwd: ${cwd})` : ''}`);
		} else {
			command = Command.create('sh', ['-c', fullCommand], cwd ? {cwd} : undefined);
			this._debugService.log(source, `Running: sh -c "${fullCommand}"${cwd ? ` (cwd: ${cwd})` : ''}`);
		}

		let output;
		try {
			output = await command.execute();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._debugService.log(source, `Failed to run command: ${message}`);
			throw new Error(message);
		} finally {
			await this.tryRemove(batchPath);
		}

		this._debugService.log(source, `Process exited with code ${output.code}`);
		if (output.stderr.trim()) {
			this._debugService.log(`${source} stderr`, output.stderr.trim());
		}
		if (output.stdout.trim()) {
			this._debugService.log(`${source} stdout`, output.stdout.trim());
		}

		return {code: output.code, stdout: output.stdout, stderr: output.stderr};
	}

	private async writeBatch(fullCommand: string, source: string): Promise<string>
	{
		const dataDir = await appDataDir();
		try {
			await mkdir(dataDir, {recursive: true});
		} catch {
			// Already exists
		}

		const batchPath = await join(dataDir, `knights-launcher-${source}-${Date.now()}.bat`);
		await writeTextFile(batchPath, `@echo off\r\n@chcp 65001 >nul\r\n${fullCommand}\r\n`);
		return batchPath;
	}

	private async tryRemove(path: string | null): Promise<void>
	{
		if (path !== null) {
			try {
				await remove(path);
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}
