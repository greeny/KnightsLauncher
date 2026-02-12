/**
 * Download metadata as returned by GET /kmr/versions/{name}/download.
 *
 * Expected API response shape:
 * {
 *     "url": "https://...", // direct link to the archive
 *     "filename": "KaM_Remake_r12345.zip", // suggested save name
 *     "size": 123456789, // bytes
 *     "checksum": "sha256:abcdef..." // for integrity verification
 * }
 */
export interface VersionDownload
{
	url: string;
	filename: string;
	size: number;
	checksum: string;
}
