import {Component, EventEmitter, Output} from "@angular/core";

/**
 * Asks how a game should be added: downloaded and installed by the
 * launcher, or picked from an installation that already exists on disk.
 * The chosen flow is handled by the install or version editor modal.
 */
@Component({
	selector: 'app-add-game-modal',
	standalone: true,
	templateUrl: './AddGameModalComponent.html',
	styleUrl: './AddGameModalComponent.css'
})
export class AddGameModalComponent
{
	@Output() public installRequested = new EventEmitter<void>();
	@Output() public addLocalRequested = new EventEmitter<void>();

	public isOpen: boolean = false;

	public open(): void
	{
		this.isOpen = true;
	}

	public close(): void
	{
		this.isOpen = false;
	}

	public chooseInstall(): void
	{
		this.isOpen = false;
		this.installRequested.emit();
	}

	public chooseAddLocal(): void
	{
		this.isOpen = false;
		this.addLocalRequested.emit();
	}
}
