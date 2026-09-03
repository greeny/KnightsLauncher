import {Component, EventEmitter, Output} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {ask, open as openDialog} from "@tauri-apps/plugin-dialog";

import {StateService} from "@src/app/storage/StateService";
import {GameDetectionService, DEFAULT_GAME_VERSION} from "@src/app/detection/GameDetectionService";
import {UninstallService, UninstallStep} from "@src/app/installation/UninstallService";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

enum ModalState
{
	Ready = 'ready',
	Saving = 'saving',
	Removing = 'removing',
	Error = 'error',
}

/**
 * Adds an existing installation to the launcher, or edits an installed
 * version. In edit mode it also offers to remove the version from the
 * launcher (files kept) or to uninstall the game completely.
 */
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
	public detectedVersion: string = DEFAULT_GAME_VERSION;
	public isDetecting: boolean = false;
	public showAdvanced: boolean = false;
	public errorMessage: string = '';
	/** Whether the "remove or uninstall" choice is shown instead of the form. */
	public isChoosingRemoval: boolean = false;
	public removalStep: UninstallStep | null = null;

	private _editingVersion: InstalledVersion | null = null;

	public constructor(
		private _stateService: StateService,
		private _detectionService: GameDetectionService,
		private _uninstallService: UninstallService
	) {}

	public openForAdd(): void
	{
		this._editingVersion = null;
		this.title = 'Add an existing installation';
		this.reset();
		this.name = '';
		this.launchArgs = '';
		this.executablePath = '';
		this.detectedVersion = DEFAULT_GAME_VERSION;
	}

	public openForEdit(version: InstalledVersion): void
	{
		this._editingVersion = version;
		this.title = version.name;
		this.reset();
		this.name = version.name;
		this.launchArgs = version.launchArgs;
		this.executablePath = version.executablePath;
		this.detectedVersion = version.version;
	}

	private reset(): void
	{
		this.isOpen = true;
		this.isDetecting = false;
		this.showAdvanced = false;
		this.isChoosingRemoval = false;
		this.removalStep = null;
		this.errorMessage = '';
		this.state = ModalState.Ready;
	}

	public get isEditing(): boolean
	{
		return this._editingVersion !== null;
	}

	public get isBusy(): boolean
	{
		return this.state === ModalState.Saving || this.state === ModalState.Removing;
	}

	public close(): void
	{
		if (this.isBusy) {
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
			const selected = await openDialog({directory: true, multiple: false, title: 'Choose the folder KaM Remake is installed in'});
			if (typeof selected === 'string') {
				this.executablePath = selected + '/KaM_Remake.exe';
				this.checkExecutableExists();
				// Auto-detect version and name in add mode
				if (!this.isEditing) {
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

		this.detectedVersion = await this._detectionService.detectVersion(this.executablePath.trim());

		// Auto-fill name if not yet set
		if (!this.name.trim()) {
			this.name = `KaM Remake ${this.detectedVersion}`;
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
			const version = this.detectedVersion.trim() || DEFAULT_GAME_VERSION;

			if (this._editingVersion === null) {
				await this._stateService.addInstalledVersion({
					name: trimmedName,
					version: version,
					executablePath: trimmedExePath,
					installedAt: new Date().toISOString(),
					order: 0, // overwritten by StateService.addInstalledVersion
					launchArgs: trimmedLaunchArgs,
				});
			} else {
				await this._stateService.updateInstalledVersion(this._editingVersion.executablePath, {
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

	public showRemovalChoice(): void
	{
		if (this._editingVersion === null || this.isBusy) {
			return;
		}

		this.errorMessage = '';
		this.isChoosingRemoval = true;
	}

	public cancelRemoval(): void
	{
		if (this.isBusy) {
			return;
		}
		this.isChoosingRemoval = false;
	}

	/** Forgets the version in the launcher; the game files stay where they are. */
	public async remove(): Promise<void>
	{
		if (this._editingVersion === null || this.isBusy) {
			return;
		}

		this.state = ModalState.Removing;
		this.removalStep = 'forgetting';
		this.errorMessage = '';

		try {
			await this._uninstallService.removeFromLauncher(this._editingVersion);
			this.isOpen = false;
			this.saved.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		} finally {
			this.removalStep = null;
		}
	}

	/** Uninstalls the game and deletes its folder, after a native confirmation dialog. */
	public async uninstall(): Promise<void>
	{
		if (this._editingVersion === null || this.isBusy) {
			return;
		}

		const confirmed = await this.confirmUninstall(this._editingVersion);
		if (!confirmed) {
			return;
		}

		this.state = ModalState.Removing;
		this.errorMessage = '';

		try {
			await this._uninstallService.uninstall(this._editingVersion, (step) => {
				this.removalStep = step;
			});
			this.isOpen = false;
			this.saved.emit();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			this.state = ModalState.Error;
		} finally {
			this.removalStep = null;
		}
	}

	public get removalStepText(): string
	{
		switch (this.removalStep) {
			case 'uninstaller':
				return 'Running the game\'s uninstaller…';
			case 'deleting':
				return 'Deleting the game folder…';
			case 'forgetting':
				return 'Removing from the launcher…';
			default:
				return 'Working…';
		}
	}

	/**
	 * Native yes/no dialog through the Tauri dialog plugin; falls back to the
	 * browser confirm in dev mode where the plugin is unavailable.
	 */
	private async confirmUninstall(version: InstalledVersion): Promise<boolean>
	{
		const message = `Uninstall "${version.name}" and delete everything in its folder?\n\n`
			+ `This removes the game together with your saved games, downloaded maps, campaigns and campaign progress in\n${this.folderPath}\n\n`
			+ `This cannot be undone.`;

		try {
			return await ask(message, {
				title: 'Uninstall game',
				kind: 'warning',
				okLabel: 'Uninstall',
				cancelLabel: 'Cancel',
			});
		} catch {
			return window.confirm(message);
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
