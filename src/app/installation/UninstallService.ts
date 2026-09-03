import {Injectable} from "@angular/core";
import {exists, remove} from "@tauri-apps/plugin-fs";
import {dirname, join} from "@tauri-apps/api/path";

import {DebugService} from "@src/app/debug/DebugService";
import {PlatformService} from "@src/app/platform/PlatformService";
import {ShellService} from "@src/app/platform/ShellService";
import {StateService} from "@src/app/storage/StateService";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

/** Name of the uninstaller Inno Setup leaves next to the game executable. */
const UNINSTALLER_FILENAME = 'unins000.exe';

/** Steps reported while uninstalling. */
export type UninstallStep = 'uninstaller' | 'deleting' | 'forgetting';

@Injectable({providedIn: 'root'})
export class UninstallService
{
	public constructor(
		private _debugService: DebugService,
		private _platformService: PlatformService,
		private _shellService: ShellService,
		private _stateService: StateService
	) {}

	/** Removes the version from the launcher only; the game files stay untouched. */
	public async removeFromLauncher(version: InstalledVersion): Promise<void>
	{
		this._debugService.log('uninstall', `Removing ${version.name} (${version.executablePath}) from the launcher, keeping files`);
		await this._stateService.removeInstalledVersion(version.executablePath);
	}

	/**
	 * Uninstalls the game completely and forgets it in the launcher.
	 *
	 * If the game folder contains the Inno Setup uninstaller it is run first
	 * (silently), so the Windows "Programs and Features" entry and any
	 * registry keys it created disappear too. The uninstaller keeps user
	 * data such as saves, maps and campaigns, so the whole folder is deleted
	 * afterwards — that is what the user asked for when choosing uninstall
	 * over remove.
	 *
	 * Refuses to delete a folder that does not look like a game folder
	 * (neither the game executable nor the uninstaller is present) so a
	 * mistyped executable path can never wipe an unrelated directory.
	 *
	 * Throws when deletion fails, e.g. because the game is still running.
	 */
	public async uninstall(version: InstalledVersion, onProgress?: (step: UninstallStep) => void): Promise<void>
	{
		const folderPath = await dirname(version.executablePath);
		const uninstallerPath = await join(folderPath, UNINSTALLER_FILENAME);

		const folderExists = await exists(folderPath);
		if (!folderExists) {
			this._debugService.log('uninstall', `Game folder ${folderPath} is already gone, only forgetting the version`);
			this.report(onProgress, 'forgetting');
			await this._stateService.removeInstalledVersion(version.executablePath);
			return;
		}

		const executableExists = await exists(version.executablePath);
		const uninstallerExists = await exists(uninstallerPath);
		if (!executableExists && !uninstallerExists) {
			throw new Error(`${folderPath} does not look like a KaM Remake folder (no game executable or uninstaller found), so it was not deleted. Remove the version from the launcher and delete the folder manually if you want to get rid of it.`);
		}

		if (uninstallerExists) {
			this.report(onProgress, 'uninstaller');
			await this.runUninstaller(folderPath);
		}

		this.report(onProgress, 'deleting');
		this._debugService.log('uninstall', `Deleting ${folderPath}`);
		try {
			// The uninstaller may already have removed the folder when it held nothing else.
			if (await exists(folderPath)) {
				await remove(folderPath, {recursive: true});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._debugService.log('uninstall', `Deleting failed: ${message}`);
			throw new Error(`Could not delete ${folderPath}: ${message}\nMake sure the game is not running and try again.`);
		}

		this.report(onProgress, 'forgetting');
		await this._stateService.removeInstalledVersion(version.executablePath);
	}

	/**
	 * Runs unins000.exe silently from the game folder and waits for it. The
	 * exit code is only logged: the folder is deleted afterwards anyway, so
	 * a partially failed uninstaller run does not stop the uninstallation.
	 */
	private async runUninstaller(folderPath: string): Promise<void>
	{
		const args = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART';
		const fullCommand = this._platformService.isWindows()
			? `"${UNINSTALLER_FILENAME}" ${args}`
			: `wine "${UNINSTALLER_FILENAME}" ${args}`;

		try {
			const result = await this._shellService.runAndWait(fullCommand, 'uninstall', folderPath);
			if (result.code !== 0) {
				this._debugService.log('uninstall', `Uninstaller exited with code ${result.code}, deleting the folder anyway`);
			}
		} catch (error) {
			this._debugService.log('uninstall', `Uninstaller could not be run (${error instanceof Error ? error.message : String(error)}), deleting the folder anyway`);
		}
	}

	private report(onProgress: ((step: UninstallStep) => void) | undefined, step: UninstallStep): void
	{
		if (onProgress) {
			onProgress(step);
		}
	}
}
