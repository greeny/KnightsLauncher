import {Injectable, NgZone} from "@angular/core";

/** Maximum number of retained log entries; oldest entries are dropped beyond this. */
const MAX_ENTRIES = 500;

/**
 * Collects debug log lines (e.g. game launch output) for display in the
 * debug output panel. Entries are always collected so that output from a
 * failed launch is available even when the panel is enabled afterwards;
 * the `enabled` flag only controls whether the panel is shown.
 */
@Injectable({providedIn: 'root'})
export class DebugService
{
	/** Whether the debug output panel is shown. Mirrors LauncherConfig.debugMode. */
	public enabled: boolean = false;

	public entries: string[] = [];

	public constructor(private _ngZone: NgZone) {}

	/**
	 * Appends a log entry. Runs inside the Angular zone because callers may
	 * be Tauri event callbacks that fire outside of it.
	 */
	public log(source: string, message: string): void
	{
		this._ngZone.run(() => {
			const time = new Date().toLocaleTimeString('en-GB');
			this.entries.push(`[${time}] [${source}] ${message}`);
			if (this.entries.length > MAX_ENTRIES) {
				this.entries.splice(0, this.entries.length - MAX_ENTRIES);
			}
		});
	}

	public clear(): void
	{
		this.entries = [];
	}
}
