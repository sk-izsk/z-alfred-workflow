export const doctorReport = (raw: unknown): string => {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { findings?: unknown }).findings))
    throw new Error("Unsupported Doctor report. Run brew doctor in Terminal.");
  const value = raw as { tier: unknown; findings: Record<string, any>[] };
  if (!value.findings.length) return `Homebrew Doctor\nSupport tier: ${value.tier}\n\nNo findings reported.`;
  return [
    `Homebrew Doctor · Tier ${value.tier}`,
    `${value.findings.length} findings`,
    ...value.findings.map((f) => {
      if (typeof f.text !== "string") throw new Error("Invalid Doctor finding.");
      const commands = Array.isArray(f.remediation?.commands)
        ? f.remediation.commands.filter((c: unknown) => typeof c === "string")
        : [];
      return `${f.text}\n${f.remediation?.text || ""}${commands.length ? "\nSuggested commands (review manually):\n" + commands.join("\n") : ""}`;
    }),
  ].join("\n\n");
};
export const vulnerabilityReport = (raw: unknown): string => {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { findings?: unknown }).findings))
    throw new Error("Unsupported vulnerability report. Homebrew 7+ is required.");
  const value = raw as Record<string, any>;
  const lines = [
    "Homebrew vulnerability scan (formulae only)",
    "A scan cannot guarantee the absence of vulnerabilities.",
  ];
  let count = 0;
  for (const finding of value.findings) {
    const advisories = Array.isArray(finding.vulnerabilities) ? finding.vulnerabilities : [];
    for (const advisory of advisories) {
      count++;
      lines.push(
        `${finding.formula} ${finding.version}\n${advisory.id} · ${advisory.severity || "Unknown severity"}\n${advisory.summary || ""}\nFixed versions: ${(advisory.fixed_versions || []).join(", ") || "Not reported"}`,
      );
    }
  }
  if (!count) lines.push("No open advisories reported for the formulae checked.");
  if (value.skipped_formulae?.length) lines.push(`Skipped: ${value.skipped_formulae.join(", ")}`);
  if (value.unscanned_formulae && Object.keys(value.unscanned_formulae).length)
    lines.push(
      `Not scanned:\n${Object.entries(value.unscanned_formulae)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}`,
    );
  if (value.outdated_without_sbom?.length)
    lines.push(`Installed-version coverage unavailable for: ${value.outdated_without_sbom.join(", ")}`);
  return lines.join("\n\n");
};
