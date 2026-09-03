import {Component, OnInit, ViewChild, isDevMode} from "@angular/core";

import {VersionListComponent} from "@src/app/components/VersionList/VersionListComponent";
import {AddGameModalComponent} from "@src/app/components/AddGameModal/AddGameModalComponent";
import {InstallVersionModalComponent} from "@src/app/components/InstallVersionModal/InstallVersionModalComponent";
import {VersionEditorModalComponent} from "@src/app/components/VersionEditorModal/VersionEditorModalComponent";
import {SettingsModalComponent} from "@src/app/components/SettingsModal/SettingsModalComponent";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";
import {ConfigService} from "@src/app/storage/ConfigService";
import {DebugService} from "@src/app/debug/DebugService";
import {UpdateService} from "@src/app/update/UpdateService";
import {Update} from "@tauri-apps/plugin-updater";

/** How often a running launcher re-checks for launcher updates, in milliseconds. */
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [VersionListComponent, AddGameModalComponent, InstallVersionModalComponent, VersionEditorModalComponent, SettingsModalComponent],
	templateUrl: './AppComponent.html',
	styleUrl: './AppComponent.css'
})
export class AppComponent implements OnInit
{
	@ViewChild(VersionListComponent) private _versionList!: VersionListComponent;
	@ViewChild(AddGameModalComponent) private _addGameModal!: AddGameModalComponent;
	@ViewChild(InstallVersionModalComponent) private _installModal!: InstallVersionModalComponent;
	@ViewChild(VersionEditorModalComponent) private _editorModal!: VersionEditorModalComponent;
	@ViewChild(SettingsModalComponent) private _settingsModal!: SettingsModalComponent;

	public availableUpdate: Update | null = null;
	public updateProgressPercent: number | null = null;
	public updateError: string | null = null;

	public constructor(
		private _configService: ConfigService,
		private _updateService: UpdateService,
		public debugService: DebugService
	) {}

	public async ngOnInit(): Promise<void>
	{
		this.disableContextMenu();

		const config = await this._configService.read();
		this.debugService.enabled = config.debugMode;
		this.availableUpdate = await this._updateService.checkForUpdate();

		// Long-running launchers keep checking, so users get new versions
		// without restarting.
		setInterval(() => this.recheckForUpdate(), UPDATE_CHECK_INTERVAL_MS);
	}

	/**
	 * The webview's right-click menu (Reload, Inspect, …) gives the app away
	 * as a web page and lets users break it by navigating; it is kept only
	 * in dev builds and inside text fields, where copy/paste is useful.
	 */
	private disableContextMenu(): void
	{
		if (isDevMode()) {
			return;
		}

		document.addEventListener('contextmenu', (event) => {
			const target = event.target as HTMLElement | null;
			if (target && (target.closest('input, textarea, .selectable, .alert') !== null)) {
				return;
			}
			event.preventDefault();
		});
	}

	private async recheckForUpdate(): Promise<void>
	{
		if (this.isUpdating) {
			return;
		}

		const update = await this._updateService.checkForUpdate();
		if (update) {
			this.availableUpdate = update;
		}
	}

	public get isUpdating(): boolean
	{
		return this.updateProgressPercent !== null;
	}

	public async installUpdate(): Promise<void>
	{
		if (!this.availableUpdate || this.isUpdating) {
			return;
		}

		this.updateError = null;
		this.updateProgressPercent = 0;

		try {
			await this._updateService.downloadAndInstall(this.availableUpdate, (downloaded, total) =>
			{
				this.updateProgressPercent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
			});
		} catch (error) {
			this.updateError = error instanceof Error ? error.message : String(error);
			this.updateProgressPercent = null;
		}
	}

	public dismissUpdate(): void
	{
		if (!this.isUpdating) {
			this.availableUpdate = null;
			this.updateError = null;
		}
	}

	public openAddGameModal(): void
	{
		this._addGameModal.open();
	}

	public openInstallModal(): void
	{
		this._installModal.open();
	}

	public openAddLocalModal(): void
	{
		this._editorModal.openForAdd();
	}

	public openSettingsModal(): void
	{
		this._settingsModal.open();
	}

	public onVersionInstalled(): void
	{
		this._versionList.refresh();
	}

	public onVersionEditorSaved(): void
	{
		this._versionList.refresh();
	}

	public async onSettingsSaved(): Promise<void>
	{
		const config = await this._configService.read();
		this.debugService.enabled = config.debugMode;
	}

	public onEditRequested(version: InstalledVersion): void
	{
		this._editorModal.openForEdit(version);
	}
}
