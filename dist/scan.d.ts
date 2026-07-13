export type Finding = {
    id: string;
    severity: "info" | "warn" | "fail" | "ok";
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
        hasLicense: boolean;
        hasDocker: boolean;
        dirty: boolean;
        lastCommitDays: number | null;
        branch: string | null;
    };
    scanned_at: string;
};
export type ScanOptions = {
    skipDirs?: string[];
};
export declare function scanRepo(rootInput: string, options?: ScanOptions): ScanReport;
export declare function formatReport(r: ScanReport): string;
export declare function formatMarkdown(r: ScanReport): string;
/** GitHub Actions workflow annotations (no path line numbers — tree-level). */
export declare function formatAnnotations(r: ScanReport): string;
export declare function gradeColor(grade: string): string;
/** Minimal SARIF 2.1.0 for GitHub code scanning / tooling. */
export declare function formatSarif(r: ScanReport): string;
/** Tiny SVG badge for READMEs / dashboards — instrument, not persona. */
export declare function badgeSvg(score: number, grade: string): string;
