import {Component, EventEmitter, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {open as openDialog} from "@tauri-apps/plugin-dialog";

import {StateService} from "@src/app/storage/StateService";
import {GameDetectionService} from "@src/app/detection/GameDetectionService";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

enum ModalState
{
	Ready = 'ready',
	Saving = 'saving',
	Error = 'error',
}

@Component({
	selector: 'app-version-editor-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './VersionEditorModalComponent.html',
	styleUrl: './VersionEditorModalComponent.css'
})
export class VersionEditorModalComponent
{
	@Output() public saved = new EventEmitter<void>();

	public readonly ModalState = ModalState;

	public title: string = '';
	public isOpen: boolean = false;
	public state: ModalState = ModalState.Ready;
	public name: string = '';
	public launchArgs: string = '';
	public executablePath: string = '';
	public detectedVersion: string | null = null;
	public isDetecting: boolean = false;
	public showAdvanced: boolean = false;
	public errorMessage: string = '';
	public isConfirmingDelete: boolean = false;
	public _editingPath: string | null = null;

	public constructor(
		private _stateService: StateService,
		private _detectionService: GameDetectionService
	) {}

	public openForAdd(): void
	{
		this._editingPath = null;
		this.title = 'Add Local Installation';
		this.isOpen = true;
		this.name = '';
		this.launchArgs = '';
		this.executablePath = '';
		this.detectedVersion = null;
		this.isDetecting = false;
		this.showAdvanced = false;
		this.isConfirmingDelete = false;
		this.errorMessage = '';
		this.state = ModalState.Ready;
	}

	public openForEdit(version: InstalledVersion): void
	{
		this._editingPath = version.executablePath;
		this.title = 'Edit Version';
		this.isOpen = true;
		this.name = version.name;
		this.launchArgs = version.launchArgs;
		this.executablePath = version.executablePath;
		this.detectedVersion = version.version;
		this.isDetecting = false;
		this.showAdvanced = false;
		this.isConfirmingDelete = false;
		this.errorMessage = '';
		this.state = ModalState.Ready;
	}

	public close(): void
	{
		if (this.state === ModalState.Saving) {
			return;
		}
		this.isOpen = false;
	}

	public get folderPath(): string
	{
		const i = Math.max(
			this.executablePath.lastIndexOf('/'),
			this.executablePath.lastIndexOf('\\')
		);
		return i >= 0 ? this.executablePath.substring(0, i) : this.executablePath;
	}

	public get canSave(): boolean
	{
		return this.name.trim() !== ''
			&& this.executablePath.trim() !== ''
			&& this.state === ModalState.Ready;
	}

	public toggleAdvanced(): void
	{
		this.showAdvanced = !this.showAdvanced;
	}

	public async browseFolderPath(): Promise<void>
	{
		try {
			const selected = await openDialog({directory: true, multiple: false});
			if (typeof selected === 'string') {
				this.executablePath = selected + '/KaM_Remake.exe';
				this.checkExecutableExists();
				// Auto-detect version and name in add mode
				if (this._editingPath === null) {
					await this.autoDetect();
				}
			}
		} catch {
			// Tauri dialog unavailable in browser dev mode — user types path manually
		}
	}

	public async browseExecutablePath(): Promise<void>
	{
		try {
			const selected = await openDialog({directory: false, multiple: false});
			if (typeof selected === 'string') {
				this.executablePath = selected;
				this.checkExecutableExists();
			}
		} catch {
			// Tauri dialog unavailable in browser dev mode — user types path manually
		}
	}

	/** Auto-detect version and prefill name if empty. Called after folder selection. */
	private async autoDetect(): Promise<void>
	{
		if (!this.executablePath.trim()) {
			return;
		}

		this.isDetecting = true;

		const detected = await this._detectionService.detectVersion(this.executablePath.trim());
		this.detectedVersion = detected;

		// Auto-fill name if not yet set
		if (!this.name.trim()) {
			this.name = this.detectedVersion;
		}

		this.isDetecting = false;
	}

	public async save(): Promise<void>
	{
		if (!this.canSave) {
			return;
		}

		this.state = ModalState.Saving;
		this.errorMessage = '';

		try {
			const trimmedName = this.name.trim();
			const trimmedExePath = this.executablePath.trim();
			const trimmedLaunchArgs = this.launchArgs.trim();

			if (this._editingPath === null) {
				// Add mode
				await this._stateService.addInstalledVersion({
					name: trimmedName,
					version: this.detectedVersion ?? 'unknown',
					executablePath: trimmedExePath,
					installedAt: new Date().toISOString(),
					order: 0, // overwritten by StateService.addInstalledVersion
					launchArgs: trimmedLaunchArgs,
				});
			} else {
				// Edit mode
				await this._stateService.updateInstalledVersion(this._editingPath, {
					name: trimmedName,
					executablePath: trimmedExePath,
					launchArgs: trimmedLaunchArgs,
				});
			}

			this.isOpen = false;
			this.saved.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		}
	}

	public delete(): void
	{
		if (this._editingPath === null || this.state !== ModalState.Ready) {
			return;
		}

		this.isConfirmingDelete = true;
	}

	public cancelDelete(): void
	{
		this.isConfirmingDelete = false;
	}

	public async confirmDelete(): Promise<void>
	{
		if (this._editingPath === null) {
			return;
		}

		this.state = ModalState.Saving;
		this.isConfirmingDelete = false;
		this.errorMessage = '';

		try {
			await this._stateService.removeInstalledVersion(this._editingPath);
			this.isOpen = false;
			this.saved.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		}
	}

	private checkExecutableExists(): void
	{
		// Best-effort check: if exe not found, show error but allow user to fix via Advanced
		if (this.executablePath.trim().endsWith('KaM_Remake.exe')) {
			// User picked a folder; exe path constructed correctly
			this.errorMessage = '';
		} else if (!this.executablePath.trim().endsWith('.exe')) {
			this.errorMessage = 'Executable path must point to KaM_Remake.exe';
		}
	}
}
