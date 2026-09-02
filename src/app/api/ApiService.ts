import {Injectable} from "@angular/core";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Observable, of} from "rxjs";
import {catchError, map} from "rxjs/operators";

import {Config} from "@src/app/Config";
import {ApiEnvelope} from "@src/app/api/model/ApiEnvelope";
import {ApiResult} from "@src/app/api/model/ApiResult";

/**
 * Base HTTP service. All API calls go through here.
 *
 * Every Knight's Tavern response is wrapped in a {code, errors, data}
 * envelope (see launcher.md); this service unwraps it into an ApiResult.
 * Errors never throw: a failed request logs a warning and yields
 * {data: null, errors: [...]}, with the API's error keys preserved when the
 * server produced an envelope (e.g. a 404 with ["versionNotFound"]).
 */
@Injectable({providedIn: 'root'})
export class ApiService
{
	public constructor(private _http: HttpClient)
	{
	}

	public get<T>(path: string): Observable<ApiResult<T>>
	{
		return this._http.get<ApiEnvelope<T>>(Config.API_BASE_URL + path).pipe(
			map((envelope): ApiResult<T> => ({data: envelope.data, errors: envelope.errors})),
			catchError((error: HttpErrorResponse) =>
			{
				const errors = this.errorKeysFrom(error);
				console.warn(`API GET failed: ${path} — ${error.message}`, errors);
				return of({data: null, errors} as ApiResult<T>);
			})
		);
	}

	/** Extracts the error keys from an error response's envelope, if it has one. */
	private errorKeysFrom(error: HttpErrorResponse): string[]
	{
		const body = error.error as Partial<ApiEnvelope<unknown>> | null;

		if (body && Array.isArray(body.errors)) {
			return body.errors.filter((key): key is string => typeof key === 'string');
		}

		return [];
	}
}
