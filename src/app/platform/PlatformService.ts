import {Injectable} from "@angular/core";
import {family} from "@tauri-apps/plugin-os";

/**
 * Platform detection. Wraps the Tauri OS plugin so the app keeps working in
 * browser dev mode, where the plugin is unavailable — that case is treated
 * as non-Windows.
 */
@Injectable({providedIn: 'root'})
export class PlatformService
{
	public isWindows(): boolean
	{
		try {
			return family() === 'windows';
		} catch {
			return false;
		}
	}
}
