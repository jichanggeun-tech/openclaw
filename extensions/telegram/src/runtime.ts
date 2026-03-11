import type { PluginRuntime } from "openclaw/plugin-sdk/telegram";

function createPluginRuntimeStore<T>(errorMessage: string): {
  setRuntime: (next: T) => void;
  clearRuntime: () => void;
  tryGetRuntime: () => T | null;
  getRuntime: () => T;
} {
  let runtime: T | null = null;
  return {
    setRuntime(next: T) { runtime = next; },
    clearRuntime() { runtime = null; },
    tryGetRuntime() { return runtime; },
    getRuntime() {
      if (!runtime) throw new Error(errorMessage);
      return runtime;
    },
  };
}

const { setRuntime: setTelegramRuntime, getRuntime: getTelegramRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Telegram runtime not initialized");
export { getTelegramRuntime, setTelegramRuntime };
