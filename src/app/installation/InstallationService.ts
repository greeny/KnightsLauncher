import {Injectable} from "@angular/core";
import {Command} from "@tauri-apps/plugin-shell";

@Injectable({providedIn: 'root'})
export class InstallationService
{
	public async runInstaller(installerPath: string, installDirectory: string): Promise<void>
	{
		try {
			const command = Command.create('cmd', [
				'/c',
				`"${installerPath}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="${installDirectory}" /NOICONS`
			]);

			const output = await command.execute();
			if (output.code !== 0) {
				throw new Error(`Installer exited with code ${output.code}: ${output.stderr}`);
			}
		} catch (error) {
			throw new Error(`Failed to run installer: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
