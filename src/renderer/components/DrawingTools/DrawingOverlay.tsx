import { useEffect, useRef, useState, useCallback } from 'react';
import { ToolPalette } from './ToolPalette';

export type DrawingTool = 'pen' | 'arrow' | 'rectangle' | 'circle' | 'highlighter';
export type DrawingColor = '#FF0000' | '#00FF00' | '#0000FF' | '#FFFF00' | '#FF00FF' | '#00FFFF' | '#FFFFFF' | '#000000';

interface DrawingAction {
  tool: DrawingTool;
  color: DrawingColor;
  size: number;
  points: { x: number; y: number }[];
}

export function DrawingOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState<DrawingColor>('#FF0000');
  const [brushSize, setBrushSize] = useState(3);
  const [history, setHistory] = useState<DrawingAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Redraw on resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redraw all history
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    history.forEach((action) => {
      drawAction(ctx, action);
    });
  }, [history]);

  // Draw a single action
  const drawAction = (ctx: CanvasRenderingContext2D, action: DrawingAction) => {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (action.tool === 'highlighter') {
      ctx.globalAlpha = 0.3;
    } else {
      ctx.globalAlpha = 1;
    }

    switch (action.tool) {
      case 'pen':
      case 'highlighter':
        if (action.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        action.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        break;

      case 'arrow':
      case 'rectangle':
      case 'circle': {
        if (action.points.length < 2) return;
        const start = action.points[0];
        const end = action.points[action.points.length - 1];

        if (action.tool === 'arrow') {
          drawArrow(ctx, start.x, start.y, end.x, end.y);
        } else if (action.tool === 'rectangle') {
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (action.tool === 'circle') {
          const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          ctx.beginPath();
          ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;
      }
    }

    ctx.globalAlpha = 1;
  };

  // Draw arrow helper
  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headLength = 20;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentAction({
      tool,
      color,
      size: brushSize,
      points: [{ x, y }],
    });

    // Disable click-through while drawing
    window.electronAPI?.setOverlayClickThrough(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const updatedAction = {
      ...currentAction,
      points: [...currentAction.points, { x, y }],
    };

    setCurrentAction(updatedAction);

    // Redraw
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      history.forEach((action) => drawAction(ctx, action));
      drawAction(ctx, updatedAction);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAction) return;

    setIsDrawing(false);
    setHistory([...history, currentAction]);
    setCurrentAction(null);

    // Re-enable click-through when not drawing
    window.electronAPI?.setOverlayClickThrough(true);
  };

  // Undo/Redo
  const handleUndo = () => {
    if (history.length === 0) return;
    setHistory(history.slice(0, -1));
  };

  const handleClear = () => {
    setHistory([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Redraw when history changes
  useEffect(() => {
    redrawCanvas();
  }, [history, redrawCanvas]);

  return (
    <div className="w-screen h-screen relative">
      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Floating toolbar */}
      {isToolbarVisible && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <ToolPalette
            tool={tool}
            color={color}
            brushSize={brushSize}
            onToolChange={setTool}
            onColorChange={setColor}
            onBrushSizeChange={setBrushSize}
            onUndo={handleUndo}
            onClear={handleClear}
            onClose={() => window.electronAPI?.closeOverlay()}
            canUndo={history.length > 0}
          />
        </div>
      )}

      {/* Toggle toolbar button */}
      {!isToolbarVisible && (
        <button
          onClick={() => setIsToolbarVisible(true)}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-dark-800/90 text-white rounded-lg shadow-xl hover:bg-dark-700 transition-colors pointer-events-auto"
        >
          Show Tools
        </button>
      )}
    </div>
  );
}
