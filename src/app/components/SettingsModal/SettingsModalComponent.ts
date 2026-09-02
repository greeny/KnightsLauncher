import {Component, EventEmitter, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {open as openDialog} from "@tauri-apps/plugin-dialog";

import {ConfigService} from "@src/app/storage/ConfigService";

@Component({
	selector: 'app-settings-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './SettingsModalComponent.html',
	styleUrl: './SettingsModalComponent.css'
})
export class SettingsModalComponent
{
	@Output() public saved = new EventEmitter<void>();

	public isOpen: boolean = false;
	public isLoading: boolean = false;
	public showHiddenVersions: boolean = false;
	public defaultInstallPath: string = '';
	public debugMode: boolean = false;

	public constructor(private _configService: ConfigService) {}

	public async open(): Promise<void>
	{
		this.isOpen = true;
		this.isLoading = true;

		const config = await this._configService.read();
		this.showHiddenVersions = config.showHiddenVersions;
		this.defaultInstallPath = config.defaultInstallPath;
		this.debugMode = config.debugMode;
		this.isLoading = false;
	}

	public close(): void
	{
		this.isOpen = false;
	}

	public async browsePath(): Promise<void>
	{
		try {
			const selected = await openDialog({directory: true, multiple: false});
			if (typeof selected === 'string') {
				this.defaultInstallPath = selected;
			}
		} catch {
			// Tauri dialog unavailable in browser dev mode — user types path manually
		}
	}

	public async save(): Promise<void>
	{
		const config = await this._configService.read();
		await this._configService.write({
			...config,
			showHiddenVersions: this.showHiddenVersions,
			defaultInstallPath: this.defaultInstallPath.trim(),
			debugMode: this.debugMode,
		});

		this.isOpen = false;
		this.saved.emit();
	}
}
