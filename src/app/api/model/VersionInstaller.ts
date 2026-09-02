/**
 * Installer metadata attached to a game version (see launcher.md):
 * {
 *     "url": "https://...", // absolute URL of the installer binary; download exactly this
 *     "filename": "kam_remake_full_r15379.exe", // suggested save name
 *     "size": 338853888, // bytes, identical to the file's Content-Length
 *     "checksum": "1f3e60ad...", // SHA-256 of the file, lowercase hex, no prefix
 *     "uploadedAt": "2026-09-02T12:01:40+02:00" // ISO 8601, informational
 * }
 */
export interface VersionInstaller
{
	url: string;
	filename: string;
	size: number;
	checksum: string;
	uploadedAt: string;
}
