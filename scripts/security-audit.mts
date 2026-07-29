import { spawnSync } from "node:child_process";

type AuditAdvisory = {
  url?: string;
  title?: string;
  severity?: string;
};

type AuditVulnerability = {
  severity: string;
  via: Array<string | AuditAdvisory>;
};

type AuditReport = {
  vulnerabilities?: Record<string, AuditVulnerability>;
};

const BLOCKED_SEVERITIES = new Set(["moderate", "high", "critical"]);
const RSC_CSRF_ADVISORY = "https://github.com/advisories/GHSA-qwww-vcr4-c8h2";

function isAcceptedSpaOnlyAdvisory(
  packageName: string,
  vulnerability: AuditVulnerability,
): boolean {
  if (packageName === "react-router") {
    return (
      vulnerability.via.length > 0 &&
      vulnerability.via.every(
        (item) => typeof item !== "string" && item.url === RSC_CSRF_ADVISORY,
      )
    );
  }

  return (
    packageName === "react-router-dom" &&
    vulnerability.via.length > 0 &&
    vulnerability.via.every((item) => item === "react-router")
  );
}

const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (!audit.stdout.trim()) {
  process.stderr.write(audit.stderr);
  throw new Error("npm audit did not return a JSON report.");
}

const report = JSON.parse(audit.stdout) as AuditReport;
const blocked: string[] = [];
const accepted: string[] = [];

for (const [packageName, vulnerability] of Object.entries(
  report.vulnerabilities ?? {},
)) {
  if (!BLOCKED_SEVERITIES.has(vulnerability.severity)) {
    continue;
  }

  if (isAcceptedSpaOnlyAdvisory(packageName, vulnerability)) {
    accepted.push(packageName);
    continue;
  }

  blocked.push(`${packageName} (${vulnerability.severity})`);
}

if (accepted.length > 0) {
  console.log(
    `[security] Accepted ${RSC_CSRF_ADVISORY} for ${accepted.join(
      ", ",
    )}: this project is a client-only BrowserRouter SPA and does not expose React Server Components or server actions.`,
  );
}

if (blocked.length > 0) {
  console.error(`[security] Blocking production vulnerabilities: ${blocked.join(", ")}`);
  process.exit(1);
}

console.log("[security] Production dependency audit passed.");
