/**
 * Unwrapped outcome of an API call: the payload on success, or null with the
 * API's error keys (e.g. "versionNotFound") on failure.
 *
 * status is the HTTP status code; 0 means the server could not be reached at
 * all (no connection, DNS failure, or a response the webview blocked, e.g.
 * missing CORS headers). Network failures yield {data: null, errors: [], status: 0}.
 */
export interface ApiResult<T>
{
	data: T | null;
	errors: string[];
	status: number;
}
