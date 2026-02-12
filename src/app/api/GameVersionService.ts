import {Injectable} from "@angular/core";
import {Observable} from "rxjs";

import {ApiService} from "@src/app/api/ApiService";
import {GameVersion} from "@src/app/api/model/GameVersion";
import {VersionDownload} from "@src/app/api/model/VersionDownload";
import {Config} from "@src/app/Config";

@Injectable({providedIn: 'root'})
export class GameVersionService
{
	private static readonly BASE_PATH: string = '';

	public constructor(private _api: ApiService)
	{
	}

	/**
	 * Returns all game versions from the server, or null if the request fails
	 * (e.g. no internet connection).
	 */
	public getVersions(): Observable<GameVersion[] | null>
	{
		return this._api.get<GameVersion[]>(GameVersionService.BASE_PATH + '/versions');
	}

	/**
	 * Returns download metadata for the given version, or null on failure.
	 * Use the returned VersionDownload.url to perform the actual download.
	 */
	public getVersionDownload(versionName: string): Observable<VersionDownload | null>
	{
		return this._api.get<VersionDownload>(
			`${GameVersionService.BASE_PATH}/download/${versionName}`
		);
	}

	/**
	 * Constructs the direct download URL for a version without an extra
	 * API round-trip. Useful for opening in an external browser as a fallback.
	 */
	public getVersionDownloadUrl(versionName: string): string
	{
		return `${Config.API_BASE_URL}${GameVersionService.BASE_PATH}/download/${versionName}/file`;
	}
}
