import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
export function loadConfig(root) {
    const p = path.join(path.resolve(root), ".solo-watch", "config.json");
    if (!existsSync(p))
        return {};
    try {
        return JSON.parse(readFileSync(p, "utf8"));
    }
    catch {
        return {};
    }
}
