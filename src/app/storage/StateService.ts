import {Injectable} from "@angular/core";
import {appDataDir} from "@tauri-apps/api/path";

import {BaseStorageService} from "@src/app/storage/BaseStorageService";
import {LauncherState} from "@src/app/storage/model/LauncherState";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

@Injectable({providedIn: 'root'})
export class StateService extends BaseStorageService<LauncherState>
{
	protected override readonly CURRENT_SCHEMA_VERSION: number = 3;
	protected override readonly FILENAME: string = 'state.json';

	protected override getDirectory(): Promise<string>
	{
		return appDataDir();
	}

	protected override getMigrations(): Array<(data: Record<string, unknown>) => Record<string, unknown>>
	{
		const migrations = super.getMigrations();
		// index 1: v1 → v2 — add launchArgs field to each installed version
		migrations[1] = (data) => ({
			...data,
			installedVersions: (data['installedVersions'] as Record<string, unknown>[]).map(
				(v) => ({...v, launchArgs: ''})
			),
		});
		// index 2: v2 → v3 — rename path to executablePath
		migrations[2] = (data) => ({
			...data,
			installedVersions: (data['installedVersions'] as Record<string, unknown>[]).map(
				(v) => {
					const path = v['path'] as string | undefined;
					return {
						...v,
						executablePath: path ? path + '/KaM_Remake.exe' : '',
					};
				}
			),
		});
		return migrations;
	}

	protected override getDefaults(): LauncherState
	{
		return {
			_schemaVersion: this.CURRENT_SCHEMA_VERSION,
			installedVersions: [],
		};
	}

	/**
	 * Adds a newly installed version and persists the state.
	 * Order is automatically assigned as last in the current list.
	 */
	public async addInstalledVersion(version: InstalledVersion): Promise<void>
	{
		const state = await this.read();
		const maxOrder = state.installedVersions.reduce(
			(max, v) => Math.max(max, v.order), -1
		);
		version.order = maxOrder + 1;
		state.installedVersions.push(version);
		await this.write(state);
	}

	/** Removes an installed version by its executable path and persists the state. */
	public async removeInstalledVersion(executablePath: string): Promise<void>
	{
		const state = await this.read();
		state.installedVersions = state.installedVersions.filter(
			v => v.executablePath !== executablePath
		);
		await this.write(state);
	}

	/**
	 * Updates mutable fields of an installed version.
	 * Identified by executable path. Does nothing if the path is not found.
	 */
	public async updateInstalledVersion(
		executablePath: string,
		changes: Partial<Pick<InstalledVersion, 'name' | 'order' | 'launchArgs' | 'executablePath'>>
	): Promise<void>
	{
		const state = await this.read();
		const entry = state.installedVersions.find(v => v.executablePath === executablePath);

		if (!entry) {
			return;
		}

		Object.assign(entry, changes);
		await this.write(state);
	}
}
