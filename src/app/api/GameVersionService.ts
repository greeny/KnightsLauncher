import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

import {ApiService} from "@src/app/api/ApiService";
import {ApiResult} from "@src/app/api/model/ApiResult";
import {GameVersion} from "@src/app/api/model/GameVersion";
import {GameVersionList} from "@src/app/api/model/GameVersionList";

@Injectable({providedIn: 'root'})
export class GameVersionService
{
	public constructor(private _api: ApiService)
	{
	}

	/**
	 * Returns all game versions plus the recommended ("latest") one, or null
	 * if the request fails (e.g. no internet connection). The list is sorted
	 * descending by versionOrder by the API.
	 */
	public getVersions(): Observable<GameVersionList | null>
	{
		return this._api.get<GameVersionList>('/game/versions').pipe(
			map((result) => result.data)
		);
	}

	/**
	 * Returns fresh metadata for one version right before downloading (an
	 * installer can be replaced, which changes checksum and size). On a
	 * success the returned version's installer is never null. On failure
	 * data is null and errors may contain "versionNotFound" or
	 * "installerNotAvailable".
	 */
	public getVersionInstaller(versionName: string): Observable<ApiResult<GameVersion>>
	{
		return this._api.get<GameVersion>(`/game/installer/${versionName}`);
	}
}
