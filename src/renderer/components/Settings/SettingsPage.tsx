import { useState, useEffect } from 'react';
import type { AppSettings } from '../../../shared/types';
import { useMediaDevices } from '../../hooks/useMediaDevices';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isEditingShortcut, setIsEditingShortcut] = useState<string | null>(null);
  const [shortcutKeys, setShortcutKeys] = useState<string[]>([]);
  const { cameras, isLoadingDevices } = useMediaDevices();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = await window.electronAPI?.getSettings();
    if (loadedSettings) {
      setSettings(loadedSettings);
      setSelectedFolder(loadedSettings.storagePath);
    }
  };

  const handleQualityChange = async (quality: AppSettings['quality']) => {
    if (!settings) return;

    const updatedSettings = { ...settings, quality };
    setSettings(updatedSettings);
    await window.electronAPI?.setSettings({ quality });
  };

  const handleFolderSelect = async () => {
    const folder = await window.electronAPI?.selectFolder();
    if (folder) {
      setSelectedFolder(folder);
      await window.electronAPI?.setSettings({ storagePath: folder });
    }
  };

  const updateWebcamSettings = async (updates: Partial<AppSettings['webcam']>) => {
    if (!settings) return;
    const updatedWebcam = { ...settings.webcam, ...updates };
    const updatedSettings = { ...settings, webcam: updatedWebcam };
    setSettings(updatedSettings);
    await window.electronAPI?.setSettings({ webcam: updatedWebcam });
  };

  const handleShortcutEdit = (shortcutKey: 'startStop' | 'pause' | 'drawing') => {
    setIsEditingShortcut(shortcutKey);
    setShortcutKeys([]);
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditingShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');

    // Add the main key (not modifier keys)
    const mainKey = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(mainKey)) {
      keys.push(mainKey.toUpperCase());
    }

    setShortcutKeys(keys);
  };

  const handleShortcutSave = async () => {
    if (!isEditingShortcut || !settings || shortcutKeys.length < 2) return;

    const accelerator = shortcutKeys.join('+');
    const updatedShortcuts = {
      ...settings.shortcuts,
      [isEditingShortcut]: accelerator,
    };

    await window.electronAPI?.setSettings({ shortcuts: updatedShortcuts });
    setSettings({ ...settings, shortcuts: updatedShortcuts });
    setIsEditingShortcut(null);
    setShortcutKeys([]);
  };

  const handleShortcutCancel = () => {
    setIsEditingShortcut(null);
    setShortcutKeys([]);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-dark-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Recording Quality */}
        <div className="card p-4">
          <h2 className="font-semibold mb-4">Recording Quality</h2>
          <select
            className="select w-full"
            value={settings.quality}
            onChange={(e) => handleQualityChange(e.target.value as AppSettings['quality'])}
          >
            <option value="720p">720p HD</option>
            <option value="1080p">1080p Full HD</option>
            <option value="1440p">1440p 2K</option>
            <option value="4k">4K Ultra HD</option>
          </select>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Frame Rate (FPS)</label>
              <input
                type="number"
                min="15"
                max="60"
                step="1"
                value={settings.frameRate}
                onChange={(e) => {
                  const value = Math.min(60, Math.max(15, Number(e.target.value)));
                  setSettings({ ...settings, frameRate: value });
                  window.electronAPI?.setSettings({ frameRate: value });
                }}
                className="input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Video Bitrate (kbps)</label>
              <input
                type="number"
                min="1000"
                max="80000"
                step="500"
                value={settings.videoBitrateKbps}
                onChange={(e) => {
                  const value = Math.min(80000, Math.max(1000, Number(e.target.value)));
                  setSettings({ ...settings, videoBitrateKbps: value });
                  window.electronAPI?.setSettings({ videoBitrateKbps: value });
                }}
                className="input w-full text-xs"
              />
            </div>
          </div>
        </div>

        {/* Storage Location */}
        <div className="card p-4">
          <h2 className="font-semibold mb-4">Storage Location</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              value={selectedFolder}
              readOnly
              placeholder="Select a folder..."
            />
            <button className="btn btn-secondary" onClick={handleFolderSelect}>
              Browse
            </button>
          </div>
        </div>

        {/* Webcam */}
        <div className="card p-4">
          <h2 className="font-semibold mb-4">Webcam</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Default Camera</label>
              <select
                className="select w-full"
                value={settings.webcam?.deviceId ?? ''}
                onChange={(e) => updateWebcamSettings({ deviceId: e.target.value || null })}
                disabled={isLoadingDevices}
              >
                <option value="">System default</option>
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Size</label>
                <select
                  className="select w-full"
                  value={settings.webcam.size}
                  onChange={(e) => updateWebcamSettings({ size: e.target.value as AppSettings['webcam']['size'] })}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Shape</label>
                <select
                  className="select w-full"
                  value={settings.webcam.shape}
                  onChange={(e) => updateWebcamSettings({ shape: e.target.value as AppSettings['webcam']['shape'] })}
                >
                  <option value="circle">Circle</option>
                  <option value="rounded">Rounded</option>
                  <option value="square">Square</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="card p-4">
          <h2 className="font-semibold mb-4">Keyboard Shortcuts</h2>
          <div className="space-y-3">
            {/* Start/Stop Recording */}
            <ShortcutRow
              label="Start/Stop Recording"
              shortcut={settings.shortcuts.startStop}
              isEditing={isEditingShortcut === 'startStop'}
              editingKeys={shortcutKeys}
              onEdit={() => handleShortcutEdit('startStop')}
              onKeyDown={handleShortcutKeyDown}
              onSave={handleShortcutSave}
              onCancel={handleShortcutCancel}
            />

            {/* Pause Recording */}
            <ShortcutRow
              label="Pause Recording"
              shortcut={settings.shortcuts.pause}
              isEditing={isEditingShortcut === 'pause'}
              editingKeys={shortcutKeys}
              onEdit={() => handleShortcutEdit('pause')}
              onKeyDown={handleShortcutKeyDown}
              onSave={handleShortcutSave}
              onCancel={handleShortcutCancel}
            />

            {/* Toggle Drawing */}
            <ShortcutRow
              label="Toggle Drawing"
              shortcut={settings.shortcuts.drawing}
              isEditing={isEditingShortcut === 'drawing'}
              editingKeys={shortcutKeys}
              onEdit={() => handleShortcutEdit('drawing')}
              onKeyDown={handleShortcutKeyDown}
              onSave={handleShortcutSave}
              onCancel={handleShortcutCancel}
            />
          </div>
          <p className="text-xs text-dark-500 mt-3">
            Click on a shortcut to change it, then press your desired key combination.
          </p>
        </div>
      </div>
    </div>
  );
}

// Shortcut row component
interface ShortcutRowProps {
  label: string;
  shortcut: string;
  isEditing: boolean;
  editingKeys: string[];
  onEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ShortcutRow({
  label,
  shortcut,
  isEditing,
  editingKeys,
  onEdit,
  onKeyDown,
  onSave,
  onCancel,
}: ShortcutRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input text-xs px-2 py-1 w-40 text-center font-mono"
            value={editingKeys.join(' + ') || 'Press keys...'}
            onKeyDown={onKeyDown}
            autoFocus
            readOnly
          />
          <button
            className="btn-icon text-green-400 hover:text-green-300"
            onClick={onSave}
            disabled={editingKeys.length < 2}
            title="Save"
          >
            <CheckIcon />
          </button>
          <button
            className="btn-icon text-red-400 hover:text-red-300"
            onClick={onCancel}
            title="Cancel"
          >
            <XIcon />
          </button>
        </div>
      ) : (
        <kbd
          className="px-3 py-1 bg-dark-700 rounded text-xs font-mono cursor-pointer hover:bg-dark-600 transition-colors"
          onClick={onEdit}
        >
          {shortcut}
        </kbd>
      )}
    </div>
  );
}

// Icons
function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
