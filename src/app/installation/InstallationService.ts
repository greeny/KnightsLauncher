import {Injectable} from "@angular/core";
import {Command} from "@tauri-apps/plugin-shell";

import {DebugService} from "@src/app/debug/DebugService";
import {PlatformService} from "@src/app/platform/PlatformService";

@Injectable({providedIn: 'root'})
export class InstallationService
{
	public constructor(
		private _debugService: DebugService,
		private _platformService: PlatformService
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
	 * directory. On non-Windows the Z: prefix maps the unix target path into
	 * wine's Z: drive (which is the unix filesystem root).
	 */
	private getDefaultInstallArgs(): string
	{
		const dir = this._platformService.isWindows() ? '%dir%' : 'Z:%dir%';
		return `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="${dir}" /NOICONS`;
	}

	/**
	 * Runs the installer and waits for it to finish.
	 *
	 * installCommand may use the %exe%, %dir% and %args% placeholders; when
	 * empty, the platform default from getDefaultInstallCommand() is used.
	 * The default installer arguments are always applied: they replace
	 * %args% when the command contains it, and are appended at the end
	 * otherwise — so a minimal command like "wine %exe%" still installs
	 * silently into the chosen directory. The command runs through the
	 * platform shell (cmd /c on Windows, sh -c elsewhere), both registered
	 * in src-tauri/capabilities/default.json.
	 *
	 * Throws when the installer cannot be started or exits non-zero.
	 */
	public async runInstaller(installerPath: string, installDirectory: string, installCommand: string = ''): Promise<void>
	{
		let template = installCommand.trim() || this.getDefaultInstallCommand();
		if (!template.includes('%args%')) {
			template += ' %args%';
		}

		// %args% first: it expands to text containing %dir%, which the next
		// replacement resolves.
		const fullCommand = template
			.replaceAll('%args%', this.getDefaultInstallArgs())
			.replaceAll('%exe%', installerPath)
			.replaceAll('%dir%', installDirectory);

		const isWindows = this._platformService.isWindows();
		const command = isWindows
			? Command.create('cmd', ['/c', fullCommand])
			: Command.create('sh', ['-c', fullCommand]);

		this._debugService.log('install', `Running: ${isWindows ? 'cmd /c' : 'sh -c'} "${fullCommand}"`);

		let output;
		try {
			output = await command.execute();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._debugService.log('install', `Failed to run installer: ${message}`);
			throw new Error(`Failed to run installer: ${message}`);
		}

		this._debugService.log('install', `Installer exited with code ${output.code}`);
		if (output.stderr.trim()) {
			this._debugService.log('installer stderr', output.stderr.trim());
		}
		if (output.stdout.trim()) {
			this._debugService.log('installer stdout', output.stdout.trim());
		}

		if (output.code !== 0) {
			throw new Error(`Installer exited with code ${output.code}${output.stderr.trim() ? ': ' + output.stderr.trim() : ''}`);
		}
	}
}
