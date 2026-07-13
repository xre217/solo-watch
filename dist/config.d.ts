export type SoloWatchConfig = {
    minScore?: number;
    history?: boolean;
    badge?: boolean;
    delta?: boolean;
};
export declare function loadConfig(root: string): SoloWatchConfig;
