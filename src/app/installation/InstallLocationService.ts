import {Injectable} from "@angular/core";
import {homeDir, join} from "@tauri-apps/api/path";
import {exists} from "@tauri-apps/plugin-fs";

import {ConfigService} from "@src/app/storage/ConfigService";

/** Name of the folder created under the user's home directory when no default install path is configured. */
const DEFAULT_GAMES_FOLDER = 'Games';

/** Prefix of the per-version folder created inside the install location. */
const GAME_FOLDER_PREFIX = 'KaM Remake';

/**
 * Decides where a new game version gets installed.
 *
 * The user (or the settings default) picks a base folder; each version is
 * installed into its own "KaM Remake rXXXXX" subfolder of it, so several
 * versions never share a directory and the folder name alone tells what is
 * inside. The subfolder name gets a " (1)", " (2)", … suffix when it already
 * exists, so an installation never lands in a non-empty folder.
 */
@Injectable({providedIn: 'root'})
export class InstallLocationService
{
	public constructor(private _configService: ConfigService) {}

	/**
	 * Base folder offered for new installations: the configured default
	 * install path, or "<home>/Games" when none is configured. The home
	 * folder is always writable without administrator rights and easy to
	 * find in a file manager, unlike Program Files or the launcher's own
	 * hidden data folder.
	 */
	public async getDefaultBasePath(): Promise<string>
	{
		const config = await this._configService.read();
		if (config.defaultInstallPath.trim()) {
			return config.defaultInstallPath.trim();
		}

		return this.getBuiltInBasePath();
	}

	/** The built-in fallback base folder ("<home>/Games"), or an empty string outside the Tauri runtime. */
	public async getBuiltInBasePath(): Promise<string>
	{
		try {
			return await join(await homeDir(), DEFAULT_GAMES_FOLDER);
		} catch {
			return '';
		}
	}

	/** Folder name a version is installed into, e.g. "KaM Remake r6720". */
	public getGameFolderName(version: string): string
	{
		return `${GAME_FOLDER_PREFIX} ${version}`;
	}

	/**
	 * Resolves the final, not yet existing install directory for a version
	 * inside the given base folder, e.g. "D:/Games/KaM Remake r6720", or
	 * "D:/Games/KaM Remake r6720 (1)" when that already exists.
	 */
	public async resolveInstallDirectory(basePath: string, version: string): Promise<string>
	{
		const folderName = this.getGameFolderName(version);
		let candidate = await this.joinPath(basePath, folderName);
		let suffix = 1;

		while (await this.pathExists(candidate)) {
			candidate = await this.joinPath(basePath, `${folderName} (${suffix})`);
			suffix++;
		}

		return candidate;
	}

	private async joinPath(base: string, name: string): Promise<string>
	{
		try {
			return await join(base, name);
		} catch {
			// Browser dev mode: no Tauri path API
			const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
			const trimmed = base.replace(/[\\/]+$/, '');
			return `${trimmed}${separator}${name}`;
		}
	}

	private async pathExists(path: string): Promise<boolean>
	{
		try {
			return await exists(path);
		} catch {
			return false;
		}
	}
}
