/**
 * Envelope wrapping every Knight's Tavern API response (see launcher.md):
 * {
 *     "code": 200, // mirrors the HTTP status code
 *     "errors": [], // machine-readable error keys, empty on success
 *     "data": {...} // the payload; empty object on error
 * }
 */
export interface ApiEnvelope<T>
{
	code: number;
	errors: string[];
	data: T;
}
