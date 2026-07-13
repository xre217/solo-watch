export type SoloWatchConfig = {
    minScore?: number;
    history?: boolean;
    badge?: boolean;
    delta?: boolean;
    /** Extra skip dir names during tree walk (in addition to built-ins). */
    skipDirs?: string[];
};
export declare function loadConfig(root: string): SoloWatchConfig;
