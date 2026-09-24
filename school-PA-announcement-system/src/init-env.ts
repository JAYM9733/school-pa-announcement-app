// Pre-startup environment initialization
// Removes tsx's global __dirname injection so that ESM modules (such as vite-plugin-pwa)
// correctly resolve their internal package.json files using import.meta.url
try {
  delete (globalThis as any).__dirname;
} catch {}
