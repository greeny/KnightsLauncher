import {join} from "@tauri-apps/api/path";
import {exists, mkdir, readTextFile, writeTextFile} from "@tauri-apps/plugin-fs";

/**
 * Base class for persistent JSON storage services.
 *
 * Subclasses define the filename, directory, defaults, and any migration
 * functions. This class handles reading, writing, and schema migration.
 *
 * All file I/O is guarded with try/catch so the app works gracefully in
 * browser dev mode (where Tauri APIs are unavailable) — reads return defaults
 * and writes are silently skipped.
 */
export abstract class BaseStorageService<T extends {_schemaVersion: number}>
{
	protected abstract readonly CURRENT_SCHEMA_VERSION: number;
	protected abstract readonly FILENAME: string;

	/** Returns the directory path where the file should be stored. */
	protected abstract getDirectory(): Promise<string>;

	/** Returns a fresh default object with the current schema version set. */
	protected abstract getDefaults(): T;

	/**
	 * Migration functions indexed by the schema version they migrate FROM.
	 * migrations[1] upgrades a v1 file to v2, migrations[2] upgrades v2 to v3, etc.
	 *
	 * Override in subclasses when the schema changes:
	 *
	 *   protected override getMigrations()
	 *   {
	 *       return [
	 *           ...super.getMigrations(),
	 *           // index 1: migrate from v1 to v2
	 *           (data) => ({...data, newField: 'defaultValue'}),
	 *       ];
	 *   }
	 */
	protected getMigrations(): Array<(data: Record<string, unknown>) => Record<string, unknown>>
	{
		return [];
	}

	public async read(): Promise<T>
	{
		try {
			const path = await join(await this.getDirectory(), this.FILENAME);

			if (!(await exists(path))) {
				return this.getDefaults();
			}

			const raw = JSON.parse(await readTextFile(path)) as Record<string, unknown>;
			return this.applyMigrations(raw);
		} catch (error) {
			console.warn(`[${this.FILENAME}] Read failed, using defaults:`, error);
			return this.getDefaults();
		}
	}

	public async write(data: T): Promise<void>
	{
		try {
			const dir = await this.getDirectory();
			await mkdir(dir, {recursive: true});
			const path = await join(dir, this.FILENAME);
			await writeTextFile(path, JSON.stringify(data, null, '\t'));
		} catch (error) {
			console.warn(`[${this.FILENAME}] Write failed:`, error);
		}
	}

	private applyMigrations(data: Record<string, unknown>): T
	{
		const storedVersion = typeof data['_schemaVersion'] === 'number'
			? data['_schemaVersion'] as number
			: 0;

		if (storedVersion === this.CURRENT_SCHEMA_VERSION) {
			// Schema is current. Merge over defaults so any newly added optional
			// fields that are missing from the stored file get their default values.
			return {...this.getDefaults(), ...data} as T;
		}

		console.info(
			`[${this.FILENAME}] Migrating schema from v${storedVersion} to v${this.CURRENT_SCHEMA_VERSION}`
		);

		const migrations = this.getMigrations();
		let current = {...data};

		for (let v = storedVersion; v < this.CURRENT_SCHEMA_VERSION; v++) {
			if (migrations[v]) {
				current = migrations[v](current);
			}
		}

		return {
			...this.getDefaults(),
			...current,
			_schemaVersion: this.CURRENT_SCHEMA_VERSION,
		} as T;
	}
}
