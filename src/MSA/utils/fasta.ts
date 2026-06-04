import type { MSAData } from "../types";

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function parseFasta(input: string): MSAData {
  const msa: MSAData = [];
  let identifier: string | null = null;
  let chunks: string[] = [];
  const flush = () => {
    if (identifier !== null) msa.push({ identifier, sequence: chunks.join("") });
  };
  input.split(/\r?\n/).forEach((line) => {
    if (line.startsWith(">")) {
      flush();
      identifier = line.substring(1).trim();
      chunks = [];
    } else if (identifier !== null && line.trim()) {
      chunks.push(line.trim());
    }
  });
  flush();
  return msa;
}

/**
 * Serializes an alignment back to FASTA text (one record per sequence, one line
 * per sequence). Round-trips with {@link parseFasta}. A trailing newline is
 * emitted so the file ends cleanly for downstream tools.
 */
export function serializeFasta(msa: MSAData): string {
  if (msa.length === 0) return "";
  return msa.map(({ identifier, sequence }) => `>${identifier}\n${sequence}`).join("\n") + "\n";
}
