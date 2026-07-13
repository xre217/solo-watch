import type { ScanReport } from "./scan.js";
export type HistoryLine = {
    ts: string;
    root: string;
    score: number;
    grade: string;
    finding_ids: string[];
};
export declare function historyPath(root: string): string;
export declare function appendHistory(report: ScanReport): string;
export declare function readHistory(root: string, limit?: number): HistoryLine[];
