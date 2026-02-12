import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {CommonModule} from "@angular/common";

import {StateService} from "@src/app/storage/StateService";
import {LaunchService} from "@src/app/launch/LaunchService";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

/** How long the launch button stays disabled after being clicked, in milliseconds. */
const LAUNCH_COOLDOWN_MS = 3000;

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

	public installedVersions: InstalledVersion[] = [];
	public isLoading: boolean = true;
	public launchError: string | null = null;

	/** Paths of installations whose launch button is currently cooling down. */
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

	public async launch(version: InstalledVersion): Promise<void>
	{
		if (this.isLaunching(version)) {
			return;
		}

		this.launchError = null;
		this._launchingPaths.add(version.executablePath);

		// Re-enable the button after the cooldown regardless of outcome,
		// so the user can retry if the launch failed.
		setTimeout(() => this._launchingPaths.delete(version.executablePath), LAUNCH_COOLDOWN_MS);

		try {
			await this._launchService.launch(version.executablePath, version.launchArgs);
		} catch (error) {
			this.launchError = error instanceof Error ? error.message : String(error);
		}
	}

	public onEditClick(version: InstalledVersion): void
	{
		this.editRequested.emit(version);
	}

	public canMoveUp(version: InstalledVersion): boolean
	{
		const index = this.installedVersions.indexOf(version);
		return index > 0;
	}

	public canMoveDown(version: InstalledVersion): boolean
	{
		const index = this.installedVersions.indexOf(version);
		return index >= 0 && index < this.installedVersions.length - 1;
	}

	public async moveUp(version: InstalledVersion): Promise<void>
	{
		const index = this.installedVersions.indexOf(version);
		if (index <= 0) {
			return;
		}

		const prevVersion = this.installedVersions[index - 1];
		const tempOrder = version.order;
		version.order = prevVersion.order;
		prevVersion.order = tempOrder;

		await this._stateService.updateInstalledVersion(version.executablePath, {order: version.order});
		await this._stateService.updateInstalledVersion(prevVersion.executablePath, {order: prevVersion.order});
		await this.refresh();
	}

	public async moveDown(version: InstalledVersion): Promise<void>
	{
		const index = this.installedVersions.indexOf(version);
		if (index < 0 || index >= this.installedVersions.length - 1) {
			return;
		}

		const nextVersion = this.installedVersions[index + 1];
		const tempOrder = version.order;
		version.order = nextVersion.order;
		nextVersion.order = tempOrder;

		await this._stateService.updateInstalledVersion(version.executablePath, {order: version.order});
		await this._stateService.updateInstalledVersion(nextVersion.executablePath, {order: nextVersion.order});
		await this.refresh();
	}
}
