import {Component, EventEmitter, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {firstValueFrom} from "rxjs";
import {open as openDialog} from "@tauri-apps/plugin-dialog";
import {family} from "@tauri-apps/plugin-os";

import {GameVersionService} from "@src/app/api/GameVersionService";
import {ConfigService} from "@src/app/storage/ConfigService";
import {StateService} from "@src/app/storage/StateService";
import {DownloadService} from "@src/app/download/DownloadService";
import {GameVersion} from "@src/app/api/model/GameVersion";

enum ModalState
{
	Loading = 'loading',
	Ready = 'ready',
	Installing = 'installing',
	Error = 'error',
	Info = 'info',
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
	public isWindows: boolean = false;
	public state: ModalState = ModalState.Loading;
	public availableVersions: GameVersion[] = [];
	public selectedVersion: GameVersion | null = null;
	public versionName: string = '';
	public installPath: string = '';
	public errorMessage: string = '';
	public downloadProgress: {stage: 'downloading' | 'writing' | 'verifying' | 'installing'; bytesDownloaded: number; totalBytes: number; percentComplete: number} | null = null;
	public linuxInstallerPath: string = '';

	private _installedVersionNames: Set<string> = new Set();

	public constructor(
		private _gameVersionService: GameVersionService,
		private _configService: ConfigService,
		private _stateService: StateService,
		private _downloadService: DownloadService
	) {}

	public open(): void
	{
		this.isOpen = true;
		this.selectedVersion = null;
		this.versionName = '';
		this.errorMessage = '';
		this.state = ModalState.Loading;
		this.loadData();
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
			&& this.versionName.trim() !== ''
			&& (this.isWindows ? this.installPath.trim() !== '' : true)
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
		this.linuxInstallerPath = '';

		try {
			const result = await this._downloadService.installVersion(
				this.selectedVersion,
				this.installPath.trim(),
				this.versionName.trim(),
				(progress) => {
					this.downloadProgress = progress;
				}
			);

			if (result.manualInstallPath) {
				this.linuxInstallerPath = result.manualInstallPath;
				this.errorMessage = 'Download complete! Automatic installation is not supported on this platform, please install the game manually using the downloaded installer.';
				this.state = ModalState.Info;
				return;
			}

			this.isOpen = false;
			this.installed.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		}
	}

	public async openLinuxInstallerFolder(): Promise<void>
	{
		if (!this.linuxInstallerPath) {
			return;
		}

		try {
			const {Command} = await import("@tauri-apps/plugin-shell");
			const folderPath = this.linuxInstallerPath.substring(0, this.linuxInstallerPath.lastIndexOf('/'));
			await Command.create('sh', ['-c', `xdg-open "${folderPath}"`]).spawn();
		} catch {
			// If opening fails, user can still manually navigate
		}
	}

	private async loadData(): Promise<void>
	{
		const [versions, config, state] = await Promise.all([
			firstValueFrom(this._gameVersionService.getVersions()),
			this._configService.read(),
			this._stateService.read(),
		]);

		if (!versions) {
			this.errorMessage = 'Could not load available versions. Check your internet connection.';
			this.state = ModalState.Error;
			return;
		}

		this.isWindows = family() === 'windows';
		this._installedVersionNames = new Set(state.installedVersions.map(v => v.version));
		this.installPath = config.defaultInstallPath;
		this.availableVersions = this.filterAndSort(versions, config.showHiddenVersions);
		this.state = ModalState.Ready;
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
