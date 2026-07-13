import type { ScanReport } from "./scan.js";
export type HistoryLine = {
    ts: string;
    root: string;
    score: number;
    grade: string;
    finding_ids: string[];
};
export type HistoryDelta = {
    has_prior: boolean;
    score_delta: number;
    grade_before: string | null;
    grade_after: string;
    new_findings: string[];
    cleared_findings: string[];
};
export declare function historyPath(root: string): string;
export declare function appendHistory(report: ScanReport): string;
export declare function readHistory(root: string, limit?: number): HistoryLine[];
export declare function deltaAgainstHistory(report: ScanReport, prior?: HistoryLine | null): HistoryDelta;
export declare function formatDelta(d: HistoryDelta): string;
