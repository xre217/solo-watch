import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type SoloWatchConfig = {
  minScore?: number;
  history?: boolean;
  badge?: boolean;
  delta?: boolean;
};

export function loadConfig(root: string): SoloWatchConfig {
  const p = path.join(path.resolve(root), ".solo-watch", "config.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SoloWatchConfig;
  } catch {
    return {};
  }
}
