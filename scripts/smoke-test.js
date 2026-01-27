const path = require('path');
const { _electron: electron } = require('playwright');

async function run() {
  const appPath = path.join(__dirname, '..');
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();

  await window.waitForLoadState('domcontentloaded');
  const title = await window.title();
  if (!title || !title.toLowerCase().includes('choome')) {
    throw new Error(`Unexpected window title: ${title}`);
  }

  const settings = await window.evaluate(() => window.electronAPI.getSettings());
  if (!settings || !settings.storagePath) {
    throw new Error('Failed to load settings from IPC');
  }

  const recordings = await window.evaluate(() => window.electronAPI.getRecordings());
  if (!Array.isArray(recordings)) {
    throw new Error('Recordings IPC did not return an array');
  }

  await app.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
