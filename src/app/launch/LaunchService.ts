import {Injectable} from "@angular/core";
import {Command} from "@tauri-apps/plugin-shell";
import {family} from '@tauri-apps/plugin-os';


@Injectable({providedIn: 'root'})
export class LaunchService
{
	/**
	 * Spawns the game from the given executable path.
	 *
	 * If launchArgs is empty the game is run directly via the registered
	 * "KaM_Remake" shell command (KaM_Remake.exe with cwd set to the folder).
	 *
	 * If launchArgs is set, %exe% inside it is replaced with the executable
	 * basename and the result is executed via a platform-specific shell:
	 *   - Linux/macOS: `sh -c "wine %exe%"` → sh -c "wine KaM_Remake.exe"
	 *   - Windows: `cmd /c "%exe%"` → cmd /c "KaM_Remake.exe"
	 *
	 * All registered commands (KaM_Remake, sh, cmd) are declared in
	 * src-tauri/capabilities/default.json.
	 *
	 * Throws a descriptive Error if the spawn fails.
	 */
	public async launch(executablePath: string, launchArgs: string = ''): Promise<void>
	{
		try {
			const folderPath = this.getFolderPath(executablePath);
			const exeBasename = this.getBasename(executablePath);
			let command;

			if (!launchArgs.trim()) {
				command = Command.create('KaM_Remake', [], {cwd: folderPath});
			} else {
				const fullCommand = launchArgs.replace('%exe%', exeBasename);
				const osType = family();

				if (osType === 'windows') {
					command = Command.create('cmd', ['/c', fullCommand], {cwd: folderPath});
				} else {
					command = Command.create('sh', ['-c', fullCommand], {cwd: folderPath});
				}
			}

			await command.spawn();
		} catch (error) {
			throw new Error(`Failed to launch game: ${error instanceof Error ? error.message : String(error)}`);
		}
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
