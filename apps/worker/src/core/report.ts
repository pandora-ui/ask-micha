import type { NormalizedItem } from "@mvp/shared";

export const buildMarkdownReport = (input: {
  runKey: string;
  mode: string;
  executiveSummary: string;
  topItems: NormalizedItem[];
}): string => {
  const lines: string[] = [];
  lines.push(`# Weekly Intelligence Report`);
  lines.push(``);
  lines.push(`- Run: ${input.runKey}`);
  lines.push(`- Mode: ${input.mode}`);
  lines.push(``);
  lines.push(`## Executive Summary`);
  lines.push(input.executiveSummary);
  lines.push(``);
  lines.push(`## Top ${input.topItems.length}`);

  input.topItems.forEach((item, index) => {
    lines.push(``);
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push(`- Score: ${item.score ?? 0}`);
    lines.push(`- URL: ${item.url}`);
    lines.push(`- Why it matters: ${item.why_it_matters ?? "n/a"}`);
    lines.push(`- Risks: ${item.risks ?? "n/a"}`);
    lines.push(`- Citations: ${(item.citation_urls ?? []).join(", ")}`);
  });

  return lines.join("\n");
};
