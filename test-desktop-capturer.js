/**
 * Simple Electron App Launcher for Manual Testing
 *
 * This script launches the Choome Electron app directly so you can manually test
 * the desktopCapturer functionality.
 *
 * Prerequisites:
 * 1. Run `npm start` once to build the app (then close it)
 * 2. Run this test: node test-desktop-capturer.js
 *
 * Manual Test Steps:
 * 1. Click "Click to select screen or window" in the preview area
 * 2. Verify that screens/windows appear in the modal
 * 3. Select a source and verify the preview works
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => resolve(true));
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function launchApp() {
  console.log('🚀 Launching Choome for manual testing...\n');

  let viteProcess;
  let electronProcess;

  try {
    // Step 1: Start the Vite dev server
    console.log('📦 Step 1: Starting Vite dev server...');

    let viteUp = await waitForServer(5173, 2000);
    if (!viteUp) {
      console.log('   Vite server not running, starting it...');
      viteProcess = spawn('npx', ['vite', '--port', '5173'], {
        cwd: __dirname,
        shell: true,
        stdio: 'pipe',
      });

      viteProcess.stdout.on('data', d => {
        const msg = d.toString().trim();
        if (msg) console.log(`   Vite: ${msg}`);
      });

      viteUp = await waitForServer(5173, 30000);
      if (!viteUp) throw new Error('Vite server failed to start');
    }
    console.log('   ✅ Vite dev server ready at http://localhost:5173\n');

    // Step 2: Check if main.js exists
    const mainJsPath = path.join(__dirname, '.vite', 'build', 'main.js');
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(`main.js not found. Run 'npm start' first to build the app.`);
    }
    console.log('   ✅ Found main.js\n');

    // Step 3: Launch Electron
    console.log('📦 Step 2: Launching Electron app...');

    const electronPath = require('electron');

    electronProcess = spawn(electronPath, [mainJsPath], {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      }
    });

    console.log('   ✅ Electron app launched!\n');

    console.log('='.repeat(50));
    console.log('📋 MANUAL TEST STEPS:');
    console.log('='.repeat(50));
    console.log('1. Click "Click to select screen or window" in the preview area');
    console.log('2. Verify that screens appear in the modal (should show 2 screens)');
    console.log('3. Select a source and verify the preview shows correctly');
    console.log('4. Close the app when done testing');
    console.log('='.repeat(50) + '\n');

    // Wait for Electron to exit
    await new Promise((resolve) => {
      electronProcess.on('close', (code) => {
        console.log(`\nElectron exited with code ${code}`);
        resolve();
      });
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (viteProcess) {
      console.log('🔄 Stopping Vite server...');
      viteProcess.kill();
    }
    console.log('✅ Done');
  }
}

launchApp();
