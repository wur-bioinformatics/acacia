import type { MSAData, SeqObject } from "../types";

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
  let currentRecord: SeqObject | null = null;
  input.split(/\r?\n/).forEach((line) => {
    if (line.startsWith(">")) {
      if (currentRecord) msa.push(currentRecord);
      currentRecord = { identifier: line.substring(1).trim(), sequence: "" };
    } else if (currentRecord && line.trim()) {
      currentRecord.sequence += line.trim();
    }
  });
  if (currentRecord) msa.push(currentRecord);
  return msa;
}
