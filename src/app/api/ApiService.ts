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
 * {data: null, errors: [...], status}, with the API's error keys preserved
 * when the server produced an envelope (e.g. a 404 with ["versionNotFound"])
 * and status 0 when the server could not be reached at all.
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
			map((envelope): ApiResult<T> => ({data: envelope.data, errors: envelope.errors, status: envelope.code})),
			catchError((error: HttpErrorResponse) =>
			{
				const errors = this.errorKeysFrom(error);
				console.warn(`API GET failed: ${path} — HTTP ${error.status} ${error.message}`, errors);
				return of({data: null, errors, status: error.status} as ApiResult<T>);
			})
		);
	}

	/**
	 * User-facing explanation for a failed ApiResult, based on the HTTP
	 * status. "Check your internet connection" is only suggested when the
	 * server was genuinely unreachable (status 0).
	 */
	public failureMessage(result: ApiResult<unknown>): string
	{
		if (result.status === 0) {
			return 'Could not reach the server. Please check your internet connection.';
		}

		if (result.status >= 500) {
			return `The server is having problems right now (HTTP ${result.status}). Please try again later.`;
		}

		if (result.status === 404) {
			return 'The server could not find the requested data (HTTP 404). The launcher may be outdated.';
		}

		if (result.status >= 400) {
			return `The server rejected the request (HTTP ${result.status}). The launcher may be outdated.`;
		}

		return `Unexpected response from the server (HTTP ${result.status}).`;
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
