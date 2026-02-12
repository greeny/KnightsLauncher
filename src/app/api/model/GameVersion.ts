/**
 * A single game version as returned by GET /kmr/versions.
 *
 * Expected API response shape (array of these):
 * {
 *     "name": "r12345", // version identifier, format rXXXXX+
 *     "hidden": false, // when true, only shown if the user enables "show hidden versions"
 *     "releasedAt": "2024-01-15T10:00:00Z", // ISO 8601
 *     "versionOrder": 12345 // numeric sort key; higher = newer
 * }
 */
export interface GameVersion
{
	name: string;
	hidden: boolean;
	releasedAt: string;
	/** Numeric sort key provided by the API. Higher value means newer version. */
	versionOrder: number;
}
