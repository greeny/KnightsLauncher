export interface InstalledVersion
{
	/** User-defined display name. Defaults to the version string on install. */
	name: string;
	/** Version identifier in rXXXXX format, or "unknown" if detection failed. */
	version: string;
	/** Absolute path to the game executable (e.g. /path/to/KaM_Remake.exe). */
	executablePath: string;
	/** ISO 8601 timestamp of when this version was installed. */
	installedAt: string;
	/** Display order in the UI. Lower values appear first. */
	order: number;
	/**
	 * Custom launch command template. Use %exe% as placeholder for the
	 * executable name (e.g. "wine %exe%"). Empty string = use default launcher.
	 */
	launchArgs: string;
}
