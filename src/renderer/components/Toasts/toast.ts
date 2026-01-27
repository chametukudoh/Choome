export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id?: string;
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

export function toast(message: ToastMessage): void {
  listeners.forEach((listener) => listener(message));
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
