import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

export interface LauncherState
{
	_schemaVersion: number;
	installedVersions: InstalledVersion[];
}
