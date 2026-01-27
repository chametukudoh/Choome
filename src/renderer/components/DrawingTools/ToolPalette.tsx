import { useState } from 'react';
import type { DrawingTool, DrawingColor } from './DrawingOverlay';

interface ToolPaletteProps {
  tool: DrawingTool;
  color: DrawingColor;
  brushSize: number;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: DrawingColor) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
  canUndo: boolean;
}

const COLORS: DrawingColor[] = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFFFFF', // White
  '#000000', // Black
];

const SIZES = [2, 3, 5, 8, 12];

export function ToolPalette({
  tool,
  color,
  brushSize,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onClear,
  onClose,
  canUndo,
}: ToolPaletteProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      {/* Main toolbar */}
      <div className="flex items-center gap-2 bg-dark-800/95 backdrop-blur-sm px-3 py-2 rounded-xl shadow-2xl border border-dark-700">
        {/* Tool selector */}
        <div className="flex gap-1 border-r border-dark-600 pr-2">
          <ToolButton
            active={tool === 'pen'}
            onClick={() => onToolChange('pen')}
            title="Pen"
          >
            <PenIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'highlighter'}
            onClick={() => onToolChange('highlighter')}
            title="Highlighter"
          >
            <HighlighterIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'arrow'}
            onClick={() => onToolChange('arrow')}
            title="Arrow"
          >
            <ArrowIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'rectangle'}
            onClick={() => onToolChange('rectangle')}
            title="Rectangle"
          >
            <RectangleIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'circle'}
            onClick={() => onToolChange('circle')}
            title="Circle"
          >
            <CircleIcon />
          </ToolButton>
        </div>

        {/* Color picker */}
        <div className="relative border-r border-dark-600 pr-2">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-8 h-8 rounded border-2 border-white/30 hover:border-white/60 transition-colors"
            style={{ backgroundColor: color }}
            title="Color"
          />
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-2 bg-dark-800 rounded-lg shadow-xl p-2 grid grid-cols-4 gap-2 z-50">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onColorChange(c);
                    setShowColorPicker(false);
                  }}
                  className={`w-8 h-8 rounded border-2 transition-colors ${
                    c === color ? 'border-primary-500' : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Brush size */}
        <div className="relative border-r border-dark-600 pr-2">
          <button
            onClick={() => setShowSizePicker(!showSizePicker)}
            className="px-3 py-1 bg-dark-700 rounded hover:bg-dark-600 transition-colors text-white text-sm font-medium"
            title="Brush Size"
          >
            {brushSize}px
          </button>
          {showSizePicker && (
            <div className="absolute top-full left-0 mt-2 bg-dark-800 rounded-lg shadow-xl p-2 flex flex-col gap-1 z-50">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onBrushSizeChange(size);
                    setShowSizePicker(false);
                  }}
                  className={`px-4 py-2 rounded transition-colors text-sm ${
                    size === brushSize
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <ActionButton
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <UndoIcon />
          </ActionButton>
          <ActionButton
            onClick={onClear}
            title="Clear All"
          >
            <ClearIcon />
          </ActionButton>
          <ActionButton
            onClick={onClose}
            title="Close Drawing Mode"
            className="text-red-400 hover:text-red-300"
          >
            <CloseIcon />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// Button components
function ToolButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-dark-300 hover:bg-dark-700 hover:text-white'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled = false,
  children,
  title,
  className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded transition-colors ${
        disabled
          ? 'text-dark-600 cursor-not-allowed'
          : `text-dark-300 hover:bg-dark-700 hover:text-white ${className}`
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

// Icons
function PenIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function HighlighterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10M3 10h18M3 6h18M3 14h18M3 18h18" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="2" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
