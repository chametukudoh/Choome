import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastMessage, type ToastType } from './toast';

interface Toast extends ToastMessage {
  id: string;
  type: ToastType;
  duration: number;
}

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeToasts((incoming) => {
      const toastItem: Toast = {
        id: incoming.id ?? crypto.randomUUID(),
        type: incoming.type ?? 'info',
        title: incoming.title,
        message: incoming.message,
        duration: incoming.duration ?? DEFAULT_DURATION,
      };

      setToasts((prev) => [...prev, toastItem]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastItem.id));
      }, toastItem.duration);
    });
  }, []);

  return (
    <div className="relative h-full">
      {children}
      <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className={`pointer-events-auto min-w-[240px] max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${
              toastItem.type === 'error'
                ? 'bg-red-950/80 border-red-700 text-red-100'
                : toastItem.type === 'warning'
                ? 'bg-amber-950/80 border-amber-700 text-amber-100'
                : toastItem.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-100'
                : 'bg-slate-900/80 border-slate-700 text-slate-100'
            }`}
          >
            <div className="text-sm font-semibold">{toastItem.title}</div>
            {toastItem.message && (
              <div className="text-xs text-slate-200/80 mt-1">{toastItem.message}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
