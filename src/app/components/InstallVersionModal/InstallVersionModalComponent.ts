import {Component, EventEmitter, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {firstValueFrom} from "rxjs";
import {open as openDialog} from "@tauri-apps/plugin-dialog";

import {GameVersionService} from "@src/app/api/GameVersionService";
import {ApiService} from "@src/app/api/ApiService";
import {ConfigService} from "@src/app/storage/ConfigService";
import {StateService} from "@src/app/storage/StateService";
import {DownloadService, DownloadProgress} from "@src/app/download/DownloadService";
import {InstallationService} from "@src/app/installation/InstallationService";
import {InstallLocationService} from "@src/app/installation/InstallLocationService";
import {GameVersion} from "@src/app/api/model/GameVersion";

enum ModalState
{
	Loading = 'loading',
	Ready = 'ready',
	Installing = 'installing',
	Error = 'error',
}

@Component({
	selector: 'app-install-version-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './InstallVersionModalComponent.html',
	styleUrl: './InstallVersionModalComponent.css'
})
export class InstallVersionModalComponent
{
	@Output() public installed = new EventEmitter<void>();

	public readonly ModalState = ModalState;

	public isOpen: boolean = false;
	public state: ModalState = ModalState.Loading;
	public availableVersions: GameVersion[] = [];
	public latestVersionName: string | null = null;
	public selectedVersion: GameVersion | null = null;
	public versionName: string = '';
	/** Folder the per-version game folder is created in (advanced setting). */
	public basePath: string = '';
	/** The final game folder, previewed as "<basePath>/KaM Remake rXXXX", empty while unresolved. */
	public resolvedInstallPath: string = '';
	public installCommand: string = '';
	public showAdvanced: boolean = false;
	public errorMessage: string = '';
	public downloadProgress: DownloadProgress | null = null;

	private _installedVersionNames: Set<string> = new Set();
	/** Whether the user typed a display name; auto-naming stops once they did. */
	private _nameEdited: boolean = false;
	/** Increases with every path resolution so a stale one cannot overwrite a newer result. */
	private _resolveCounter: number = 0;

	public constructor(
		private _gameVersionService: GameVersionService,
		private _apiService: ApiService,
		private _configService: ConfigService,
		private _stateService: StateService,
		private _downloadService: DownloadService,
		private _installationService: InstallationService,
		private _installLocationService: InstallLocationService
	) {}

	public open(): void
	{
		this.isOpen = true;
		this.selectedVersion = null;
		this.versionName = '';
		this.basePath = '';
		this.resolvedInstallPath = '';
		this.errorMessage = '';
		this.showAdvanced = false;
		this.downloadProgress = null;
		this._nameEdited = false;
		this.installCommand = this._installationService.getDefaultInstallCommand();
		this.state = ModalState.Loading;
		this.loadData();
	}

	public toggleAdvanced(): void
	{
		this.showAdvanced = !this.showAdvanced;
	}

	public close(): void
	{
		if (this.state === ModalState.Installing) {
			return;
		}
		this.isOpen = false;
	}

	public isInstalled(version: GameVersion): boolean
	{
		return this._installedVersionNames.has(version.name);
	}

	public isLatest(version: GameVersion): boolean
	{
		return version.name === this.latestVersionName;
	}

	public onVersionSelected(): void
	{
		if (this.selectedVersion && !this._nameEdited) {
			this.versionName = this.defaultName(this.selectedVersion);
		}
		this.updateResolvedPath();
	}

	public onNameEdited(): void
	{
		this._nameEdited = this.versionName.trim() !== '';
	}

	public onBasePathEdited(): void
	{
		this.updateResolvedPath();
	}

	public get canInstall(): boolean
	{
		return this.selectedVersion !== null
			&& this.selectedVersion.installer !== null
			&& this.versionName.trim() !== ''
			&& this.basePath.trim() !== ''
			&& this.state === ModalState.Ready;
	}

	public async browseBasePath(): Promise<void>
	{
		try {
			const selected = await openDialog({directory: true, multiple: false, title: 'Choose where to install the game'});
			if (typeof selected === 'string') {
				this.basePath = selected;
				this.updateResolvedPath();
			}
		} catch {
			// Tauri dialog unavailable in browser dev mode — user types path manually
		}
	}

	public async install(): Promise<void>
	{
		if (!this.canInstall || !this.selectedVersion) {
			return;
		}

		this.state = ModalState.Installing;
		this.downloadProgress = null;

		try {
			// Resolved again right before installing, so a folder created in
			// the meantime is never reused.
			const installPath = await this._installLocationService.resolveInstallDirectory(this.basePath.trim(), this.selectedVersion.name);
			this.resolvedInstallPath = installPath;

			await this._downloadService.installVersion(
				this.selectedVersion,
				installPath,
				this.versionName.trim(),
				this.installCommand.trim(),
				(progress) => {
					this.downloadProgress = progress;
				}
			);

			this.isOpen = false;
			this.installed.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		}
	}

	/** Lets the user fix the settings and retry after a failed installation. */
	public backToForm(): void
	{
		this.errorMessage = '';
		this.downloadProgress = null;
		this.state = ModalState.Ready;
	}

	private async loadData(): Promise<void>
	{
		const [versionsResult, config, state, defaultBasePath] = await Promise.all([
			firstValueFrom(this._gameVersionService.getVersions()),
			this._configService.read(),
			this._stateService.read(),
			this._installLocationService.getDefaultBasePath(),
		]);

		const versionList = versionsResult.data;
		if (!versionList) {
			this.errorMessage = `Could not load available versions. ${this._apiService.failureMessage(versionsResult)}`;
			this.state = ModalState.Error;
			return;
		}

		this._installedVersionNames = new Set(state.installedVersions.map(v => v.version));
		this.basePath = defaultBasePath;
		this.latestVersionName = versionList.latest;
		this.availableVersions = this.filterAndSort(versionList.versions, config.showHiddenVersions);
		this.preselectLatest(versionList.latest);
		this.state = ModalState.Ready;
	}

	/** Pre-selects the version the API recommends (newest visible one with an installer). */
	private preselectLatest(latest: string | null): void
	{
		if (latest === null) {
			return;
		}

		const version = this.availableVersions.find(v => v.name === latest);
		if (version) {
			this.selectedVersion = version;
			this.onVersionSelected();
		}
	}

	private defaultName(version: GameVersion): string
	{
		return `KaM Remake ${version.name}`;
	}

	private async updateResolvedPath(): Promise<void>
	{
		const counter = ++this._resolveCounter;

		if (!this.selectedVersion || !this.basePath.trim()) {
			this.resolvedInstallPath = '';
			return;
		}

		const resolved = await this._installLocationService.resolveInstallDirectory(this.basePath.trim(), this.selectedVersion.name);
		if (counter === this._resolveCounter) {
			this.resolvedInstallPath = resolved;
		}
	}

	private filterAndSort(versions: GameVersion[], showHidden: boolean): GameVersion[]
	{
		const filtered: GameVersion[] = [];
		for (const v of versions) {
			if (showHidden || !v.hidden) {
				filtered.push(v);
			}
		}
		filtered.sort((a, b) => b.versionOrder - a.versionOrder);
		return filtered;
	}
}
