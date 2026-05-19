import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const contentDir = join(here, "content");
const assetsDir = join(repoRoot, "public", "docs-assets");
const srcDir = join(repoRoot, "src");

function readMarkdownFiles(): { path: string; text: string }[] {
  return readdirSync(contentDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ path: join(contentDir, f), text: readFileSync(join(contentDir, f), "utf8") }));
}

function walkTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walkTsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function collectHeadingSlugs(): Set<string> {
  const slugger = new GithubSlugger();
  const slugs = new Set<string>();
  let inFence = false;
  for (const file of readMarkdownFiles()) {
    for (const line of file.text.split("\n")) {
      if (line.startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
      if (m) slugs.add(slugger.slug(m[1]));
    }
  }
  return slugs;
}

describe("docs contract", () => {
  it("every Markdown image under /docs-assets/ exists in public/docs-assets/", () => {
    const missing: string[] = [];
    for (const { text } of readMarkdownFiles()) {
      const re = /!\[[^\]]*\]\(\/docs-assets\/([^)\s]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const filename = match[1];
        if (!existsSync(join(assetsDir, filename))) missing.push(filename);
      }
    }
    expect(missing, `Missing screenshots in public/docs-assets/: ${missing.join(", ")}`).toEqual([]);
  });

  it("every <HelpButton anchor=...> resolves to a heading in the docs", () => {
    const slugs = collectHeadingSlugs();
    const re = /<HelpButton[^>]*\sanchor=["']([^"']+)["']/g;
    const unresolved: string[] = [];
    for (const file of walkTsxFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        if (!slugs.has(match[1])) unresolved.push(`${match[1]} (in ${file})`);
      }
    }
    expect(unresolved, `HelpButton anchors with no matching heading: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("every openDocs(anchor) call resolves to a heading in the docs", () => {
    const slugs = collectHeadingSlugs();
    const re = /openDocs\(["']([^"']+)["']\)/g;
    const unresolved: string[] = [];
    for (const file of walkTsxFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        if (!slugs.has(match[1])) unresolved.push(`${match[1]} (in ${file})`);
      }
    }
    expect(unresolved, `openDocs anchors with no matching heading: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("each main toolbar surface mounts a HelpButton", () => {
    const surfaces = [
      "src/MSA/components/MSAToolbar.tsx",
      "src/tree/components/TreeToolbar.tsx",
      "src/NJ/DistanceMatrix.tsx",
    ];
    for (const rel of surfaces) {
      const text = readFileSync(join(repoRoot, rel), "utf8");
      expect(text, `${rel} should contain a <HelpButton`).toMatch(/<HelpButton\b/);
    }
  });
});
