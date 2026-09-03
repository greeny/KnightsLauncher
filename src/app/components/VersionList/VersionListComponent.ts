import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {CommonModule} from "@angular/common";

import {StateService} from "@src/app/storage/StateService";
import {LaunchService} from "@src/app/launch/LaunchService";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";
import {Config} from "@src/app/Config";

/** How long a card stays in the "starting" state after being clicked, in milliseconds. */
const LAUNCH_COOLDOWN_MS = 3000;

/**
 * Grid of installed game versions, one card each, plus an "Add game" card at
 * the end. Clicking a card launches the game; cards can be dragged onto each
 * other to reorder them. Requires dragDropEnabled: false in tauri.conf.json,
 * otherwise Tauri intercepts HTML5 drag events on Windows.
 */
@Component({
	selector: 'app-version-list',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './VersionListComponent.html',
	styleUrl: './VersionListComponent.css'
})
export class VersionListComponent implements OnInit
{
	@Output() public editRequested = new EventEmitter<InstalledVersion>();
	@Output() public addRequested = new EventEmitter<void>();

	public installedVersions: InstalledVersion[] = [];
	public isLoading: boolean = true;
	public launchError: string | null = null;

	/** The card currently being dragged, if any. */
	public draggedVersion: InstalledVersion | null = null;

	/** Paths of installations whose card is currently in the launch cooldown. */
	private _launchingPaths: Set<string> = new Set();

	public constructor(
		private _stateService: StateService,
		private _launchService: LaunchService
	) {}

	public ngOnInit(): void
	{
		this.refresh();
	}

	public async refresh(): Promise<void>
	{
		this.isLoading = true;
		const state = await this._stateService.read();
		this.installedVersions = [...state.installedVersions].sort((a, b) => a.order - b.order);
		this.isLoading = false;
	}

	public isLaunching(version: InstalledVersion): boolean
	{
		return this._launchingPaths.has(version.executablePath);
	}

	/**
	 * Icon shown on the cards, from public/icons/games/<game slug>.png. The
	 * launcher manages one game today, so this is the configured game's
	 * icon; once more games are supported it will be chosen per version.
	 */
	public get gameIconPath(): string
	{
		return `icons/games/${Config.GAME}.png`;
	}

	public folderPath(version: InstalledVersion): string
	{
		const path = version.executablePath;
		const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
		return i >= 0 ? path.substring(0, i) : path;
	}

	public async launch(version: InstalledVersion): Promise<void>
	{
		if (this.isLaunching(version)) {
			return;
		}

		this.launchError = null;
		this._launchingPaths.add(version.executablePath);

		// Re-enable the card after the cooldown regardless of outcome,
		// so the user can retry if the launch failed.
		setTimeout(() => this._launchingPaths.delete(version.executablePath), LAUNCH_COOLDOWN_MS);

		try {
			await this._launchService.launch(version.executablePath, version.launchArgs);
		} catch (error) {
			this.launchError = error instanceof Error ? error.message : String(error);
		}
	}

	/**
	 * Enter launches the game only when the card itself has focus; when the
	 * edit button inside it is focused, Enter belongs to the button.
	 */
	public onCardKeydown(event: Event, version: InstalledVersion): void
	{
		if (event.target === event.currentTarget) {
			event.preventDefault();
			this.launch(version);
		}
	}

	/** The edit button sits inside the clickable card, so the click must not also launch the game. */
	public onEditClick(event: Event, version: InstalledVersion): void
	{
		event.stopPropagation();
		this.editRequested.emit(version);
	}

	public onAddClick(): void
	{
		this.addRequested.emit();
	}

	public onDragStart(event: DragEvent, version: InstalledVersion): void
	{
		this.draggedVersion = version;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			// Some webviews cancel the drag when no data is set.
			event.dataTransfer.setData('text/plain', version.executablePath);
		}
	}

	/**
	 * Moves the dragged card to the position of the card being hovered, so
	 * the list reorders live while dragging. Angular tracks cards by path,
	 * so the DOM nodes move instead of being recreated and the drag goes on.
	 */
	public onDragEnter(event: DragEvent, target: InstalledVersion): void
	{
		event.preventDefault();

		if (this.draggedVersion === null || this.draggedVersion === target) {
			return;
		}

		const from = this.installedVersions.indexOf(this.draggedVersion);
		const to = this.installedVersions.indexOf(target);
		if (from < 0 || to < 0) {
			return;
		}

		this.installedVersions.splice(from, 1);
		this.installedVersions.splice(to, 0, this.draggedVersion);
	}

	/** Allowing the drop is what makes the browser show a "move" cursor instead of "forbidden". */
	public onDragOver(event: DragEvent): void
	{
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	public onDrop(event: DragEvent): void
	{
		event.preventDefault();
	}

	/** Fires after a drop or a cancelled drag; the in-memory order is persisted either way. */
	public async onDragEnd(): Promise<void>
	{
		if (this.draggedVersion === null) {
			return;
		}

		this.draggedVersion = null;

		const paths: string[] = [];
		for (let i = 0; i < this.installedVersions.length; i++) {
			this.installedVersions[i].order = i;
			paths.push(this.installedVersions[i].executablePath);
		}

		await this._stateService.reorderInstalledVersions(paths);
	}
}
