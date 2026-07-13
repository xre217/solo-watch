export type Finding = {
    id: string;
    severity: "info" | "warn" | "fail";
    title: string;
    detail: string;
    weight: number;
};
export type ScanReport = {
    root: string;
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    findings: Finding[];
    meta: {
        isGit: boolean;
        hasPackageJson: boolean;
        hasCi: boolean;
        hasTests: boolean;
        hasReadme: boolean;
        dirty: boolean;
        lastCommitDays: number | null;
    };
};
export declare function scanRepo(rootInput: string): ScanReport;
export declare function formatReport(r: ScanReport): string;
