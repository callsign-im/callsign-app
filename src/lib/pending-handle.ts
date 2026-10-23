const KEY = "callsign:pending-handle";

export function rememberPendingHandle(handle: string): void {
  try {
    localStorage.setItem(KEY, handle);
  } catch {}
}

export function takePendingHandle(): string | null {
  try {
    const handle = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return handle;
  } catch {
    return null;
  }
}
