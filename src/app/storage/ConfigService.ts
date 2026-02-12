import {Injectable} from "@angular/core";
import {appConfigDir} from "@tauri-apps/api/path";

import {BaseStorageService} from "@src/app/storage/BaseStorageService";
import {LauncherConfig} from "@src/app/storage/model/LauncherConfig";

@Injectable({providedIn: 'root'})
export class ConfigService extends BaseStorageService<LauncherConfig>
{
	protected override readonly CURRENT_SCHEMA_VERSION: number = 1;
	protected override readonly FILENAME: string = 'config.json';

	protected override getDirectory(): Promise<string>
	{
		return appConfigDir();
	}

	protected override getDefaults(): LauncherConfig
	{
		return {
			_schemaVersion: this.CURRENT_SCHEMA_VERSION,
			showHiddenVersions: false,
			defaultInstallPath: '',
		};
	}

	// Example of how a future migration would look:
	//
	// protected override getMigrations()
	// {
	//     return [
	//         ...super.getMigrations(),
	//         // index 1: v1 → v2 (added 'checkForUpdatesOnStart')
	//         (data) => ({...data, checkForUpdatesOnStart: true}),
	//     ];
	// }
}
