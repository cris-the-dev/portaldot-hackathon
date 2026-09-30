import pc from "picocolors";
import type { CheckStatus, DoctorReport } from "./doctor.js";

const ICON: Record<CheckStatus, string> = {
  pass: pc.green("✔"),
  warn: pc.yellow("!"),
  fail: pc.red("✖"),
  skip: pc.dim("-"),
};

export function formatReport(report: DoctorReport): string {
  const lines = [pc.bold(`portalkit doctor — ${report.network}`), ""];
  for (const check of report.checks) {
    lines.push(`${ICON[check.status]} ${check.title.padEnd(28)} ${pc.dim(check.detail)}`);
  }
  lines.push("", report.ok ? pc.green("All required checks passed.") : pc.red("Some checks failed."));
  return lines.join("\n");
}
