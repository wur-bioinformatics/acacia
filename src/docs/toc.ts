import GithubSlugger from "github-slugger";
import { docsContent } from "./content";

export interface TocEntry {
  id: string;
  text: string;
  depth: 1 | 2 | 3;
}

function buildToc(): TocEntry[] {
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  const lines = docsContent.split("\n");
  let inFence = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const depth = match[1].length as 1 | 2 | 3;
    const text = match[2];
    entries.push({ id: slugger.slug(text), text, depth });
  }

  return entries;
}

export const toc: TocEntry[] = buildToc();
