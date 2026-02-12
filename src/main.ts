import { getVersion } from "@tauri-apps/api/app";

async function init(): Promise<void> {
  const version = await getVersion();
  document.body.innerHTML = `
    <div class="container">
      <h1>Knights and Merchants REMAKE</h1>
      <p>Launcher v${version}</p>
      <p class="status">Ready.</p>
    </div>
  `;
}

init();
