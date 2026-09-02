import {isDevMode} from "@angular/core";

export class Config
{
	/**
	 * Game slug the launcher manages. The whole Knight's Tavern API is scoped
	 * by game: 'kmr' = KaM Remake, 'kp' = Knight's Province.
	 */
	public static readonly GAME: string = 'kmr';

	private static readonly DEV_HOST: string = 'https://knights-tavern.local';
	private static readonly PROD_HOST: string = 'https://www.knights-tavern.com';

	/**
	 * Base URL for the Knight's Tavern API, including the game scope.
	 * All service paths are relative to this. See launcher.md for the contract.
	 */
	public static get API_BASE_URL(): string
	{
		const host = isDevMode() ? Config.DEV_HOST : Config.PROD_HOST;
		return `${host}/api/v1/${Config.GAME}`;
	}
}
