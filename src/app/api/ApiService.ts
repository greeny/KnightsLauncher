import {Injectable} from "@angular/core";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Observable, of} from "rxjs";
import {catchError} from "rxjs/operators";

import {Config} from "@src/app/Config";

/**
 * Base HTTP service. All API calls go through here.
 *
 * Error handling is centralised: any failed request logs a warning and returns
 * null instead of throwing, so the rest of the app can treat a missing
 * connection the same as any other "no data" state.
 */
@Injectable({providedIn: 'root'})
export class ApiService
{
	public constructor(private _http: HttpClient)
	{
	}

	public get<T>(path: string): Observable<T | null>
	{
		return this._http.get<T>(Config.API_BASE_URL + path).pipe(
			catchError((error: HttpErrorResponse) =>
			{
				console.warn(`API GET failed: ${path} — ${error.message}`);
				return of(null);
			})
		);
	}
}
