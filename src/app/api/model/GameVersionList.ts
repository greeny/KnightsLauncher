import {GameVersion} from "@src/app/api/model/GameVersion";

/**
 * Payload of GET {API_BASE_URL}/game/versions (see launcher.md):
 * {
 *     "latest": "r15379", // name of the newest non-hidden version with an installer, or null
 *     "versions": [...] // all versions, sorted descending by versionOrder
 * }
 */
export interface GameVersionList
{
	latest: string | null;
	versions: GameVersion[];
}
