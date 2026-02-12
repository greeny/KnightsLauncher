import {Component, ViewChild} from "@angular/core";

import {VersionListComponent} from "@src/app/components/VersionList/VersionListComponent";
import {InstallVersionModalComponent} from "@src/app/components/InstallVersionModal/InstallVersionModalComponent";
import {VersionEditorModalComponent} from "@src/app/components/VersionEditorModal/VersionEditorModalComponent";
import {InstalledVersion} from "@src/app/storage/model/InstalledVersion";

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [VersionListComponent, InstallVersionModalComponent, VersionEditorModalComponent],
	templateUrl: './AppComponent.html',
	styleUrl: './AppComponent.css'
})
export class AppComponent
{
	@ViewChild(VersionListComponent) private _versionList!: VersionListComponent;
	@ViewChild(InstallVersionModalComponent) private _installModal!: InstallVersionModalComponent;
	@ViewChild(VersionEditorModalComponent) private _editorModal!: VersionEditorModalComponent;

	public openInstallModal(): void
	{
		this._installModal.open();
	}

	public openAddLocalModal(): void
	{
		this._editorModal.openForAdd();
	}

	public onVersionInstalled(): void
	{
		this._versionList.refresh();
	}

	public onVersionEditorSaved(): void
	{
		this._versionList.refresh();
	}

	public onEditRequested(version: InstalledVersion): void
	{
		this._editorModal.openForEdit(version);
	}
}
