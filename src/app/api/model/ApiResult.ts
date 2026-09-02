/**
 * Unwrapped outcome of an API call: the payload on success, or null with the
 * API's error keys (e.g. "versionNotFound") on failure. Network failures
 * yield {data: null, errors: []}.
 */
export interface ApiResult<T>
{
	data: T | null;
	errors: string[];
}
