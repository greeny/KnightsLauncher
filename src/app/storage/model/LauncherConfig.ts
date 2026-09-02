export interface LauncherConfig
{
	_schemaVersion: number;
	showHiddenVersions: boolean;
	/** Default directory offered when installing a new version. */
	defaultInstallPath: string;
	/** Whether the debug output panel is shown in the main window. */
	debugMode: boolean;
}
