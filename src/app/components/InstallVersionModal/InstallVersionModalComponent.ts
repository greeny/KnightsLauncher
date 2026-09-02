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
	public selectedVersion: GameVersion | null = null;
	public versionName: string = '';
	public installPath: string = '';
	public installCommand: string = '';
	public showAdvanced: boolean = false;
	public errorMessage: string = '';
	public downloadProgress: DownloadProgress | null = null;

	private _installedVersionNames: Set<string> = new Set();

	public constructor(
		private _gameVersionService: GameVersionService,
		private _apiService: ApiService,
		private _configService: ConfigService,
		private _stateService: StateService,
		private _downloadService: DownloadService,
		private _installationService: InstallationService
	) {}

	public open(): void
	{
		this.isOpen = true;
		this.selectedVersion = null;
		this.versionName = '';
		this.errorMessage = '';
		this.showAdvanced = false;
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

	public onVersionSelected(): void
	{
		if (this.selectedVersion) {
			this.versionName = this.selectedVersion.name;
		}
	}

	public get canInstall(): boolean
	{
		return this.selectedVersion !== null
			&& this.selectedVersion.installer !== null
			&& this.versionName.trim() !== ''
			&& this.installPath.trim() !== ''
			&& this.state === ModalState.Ready;
	}

	public async browsePath(): Promise<void>
	{
		try {
			const selected = await openDialog({directory: true, multiple: false});
			if (typeof selected === 'string') {
				this.installPath = selected;
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
			await this._downloadService.installVersion(
				this.selectedVersion,
				this.installPath.trim(),
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

	private async loadData(): Promise<void>
	{
		const [versionsResult, config, state] = await Promise.all([
			firstValueFrom(this._gameVersionService.getVersions()),
			this._configService.read(),
			this._stateService.read(),
		]);

		const versionList = versionsResult.data;
		if (!versionList) {
			this.errorMessage = `Could not load available versions. ${this._apiService.failureMessage(versionsResult)}`;
			this.state = ModalState.Error;
			return;
		}

		this._installedVersionNames = new Set(state.installedVersions.map(v => v.version));
		this.installPath = config.defaultInstallPath;
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
