import {VersionInstaller} from "@src/app/api/model/VersionInstaller";

/**
 * A single game version as returned by GET {API_BASE_URL}/game/versions and
 * GET {API_BASE_URL}/game/installer/{name}. See launcher.md for the contract.
 *
 * {
 *     "name": "r15379", // version identifier as reported by the game itself
 *     "versionOrder": 15379, // numeric sort key; higher = newer
 *     "hidden": false, // when true, only shown if the user enables "show hidden versions"
 *     "releasedAt": "2025-06-01T12:00:00+02:00", // ISO 8601, null for auto-registered versions
 *     "installer": {...} // null until an installer is uploaded for this version
 * }
 */
export interface GameVersion
{
	name: string;
	/** Numeric sort key provided by the API. Higher value means newer version. */
	versionOrder: number;
	hidden: boolean;
	releasedAt: string | null;
	/** Null when no installer has been uploaded yet — the version is not installable. */
	installer: VersionInstaller | null;
}
