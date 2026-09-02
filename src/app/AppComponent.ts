import {Component, OnInit, ViewChild} from "@angular/core";

import {VersionListComponent} from "@src/app/components/VersionList/VersionListComponent";
import {InstallVersionModalComponent} from "@src/app/components/InstallVersionModal/InstallVersionModalComponent";
import {VersionEditorModalComponent} from "@src/app/components/VersionEditorModal/VersionEditorModalComponent";
import {SettingsModalComponent} from "@src/app/components/SettingsModal/SettingsModalComponent";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";
import {ConfigService} from "@src/app/storage/ConfigService";
import {DebugService} from "@src/app/debug/DebugService";

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [VersionListComponent, InstallVersionModalComponent, VersionEditorModalComponent, SettingsModalComponent],
	templateUrl: './AppComponent.html',
	styleUrl: './AppComponent.css'
})
export class AppComponent implements OnInit
{
	@ViewChild(VersionListComponent) private _versionList!: VersionListComponent;
	@ViewChild(InstallVersionModalComponent) private _installModal!: InstallVersionModalComponent;
	@ViewChild(VersionEditorModalComponent) private _editorModal!: VersionEditorModalComponent;
	@ViewChild(SettingsModalComponent) private _settingsModal!: SettingsModalComponent;

	public constructor(
		private _configService: ConfigService,
		public debugService: DebugService
	) {}

	public async ngOnInit(): Promise<void>
	{
		const config = await this._configService.read();
		this.debugService.enabled = config.debugMode;
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
