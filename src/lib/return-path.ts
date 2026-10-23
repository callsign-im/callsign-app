const KEY = "callsign:return-path";

function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function rememberReturnPath(path: string): void {
  if (!isLocalPath(path)) return;
  try {
    localStorage.setItem(KEY, path);
  } catch {}
}

export function takeReturnPath(): string | null {
  try {
    const path = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return path && isLocalPath(path) ? path : null;
  } catch {
    return null;
  }
}
