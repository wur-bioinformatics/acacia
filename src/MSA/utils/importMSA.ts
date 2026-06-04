import type { MSAData } from "../types";
import { parseFasta, readTextFile } from "./fasta";

// Single shared pipeline for bringing an external FASTA file into the app, used
// by both the empty-state uploader and the File menu. Reading, parsing and
// validation all live here so the two entry points behave identically.

export type ImportResult =
  | { ok: true; msa: MSAData }
  | { ok: false; error: string };

// Residues we accept in an aligned sequence: any letter (covers DNA/RNA/protein
// plus IUPAC ambiguity codes), gap characters (`-` `.`), the stop/translation
// symbols `*` `~`, and the unknown marker `?`. Anything else (digits, spaces,
// punctuation) indicates the file isn't an aligned FASTA.
const ALLOWED_RESIDUE = /[A-Za-z.*\-~?]/;
const ALLOWED_SEQUENCE = /^[A-Za-z.*\-~?]*$/;

function describeChar(c: string): string {
  if (c === " ") return "space";
  if (c === "\t") return "tab";
  return `"${c}"`;
}

function listNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).map((n) => `"${n}"`).join(", ");
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown;
}

/**
 * Validates a parsed alignment, returning the data on success or a single,
 * specific error message on the first problem found. Checks are ordered from
 * most fundamental (no records) to most detailed (alignment width).
 */
export function validateMSA(msa: MSAData): ImportResult {
  if (msa.length === 0) {
    return { ok: false, error: "No sequences found — is this a FASTA file? Headers must start with '>'." };
  }

  // Identifiers: present and unique (the app keys selection, ordering and edits
  // by identifier, so duplicates would silently collide).
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const { identifier } of msa) {
    if (identifier.length === 0) {
      return { ok: false, error: "A record has an empty identifier (a '>' line with no name)." };
    }
    if (seen.has(identifier) && !duplicates.includes(identifier)) duplicates.push(identifier);
    seen.add(identifier);
  }
  if (duplicates.length > 0) {
    return {
      ok: false,
      error: `Duplicate sequence ${duplicates.length === 1 ? "identifier" : "identifiers"}: ${listNames(duplicates)}. Identifiers must be unique.`,
    };
  }

  // No empty sequences (a header followed by no residue lines).
  const empty = msa.find((s) => s.sequence.length === 0);
  if (empty) {
    return { ok: false, error: `Sequence "${empty.identifier}" has no residues.` };
  }

  // Residue alphabet.
  for (const { identifier, sequence } of msa) {
    if (!ALLOWED_SEQUENCE.test(sequence)) {
      const bad = [...new Set(sequence)]
        .filter((c) => !ALLOWED_RESIDUE.test(c))
        .map(describeChar);
      return {
        ok: false,
        error: `Sequence "${identifier}" contains unexpected ${bad.length === 1 ? "character" : "characters"}: ${bad.slice(0, 5).join(", ")}. Only residues, gaps (- .) and * ~ ? are allowed.`,
      };
    }
  }

  // Alignment width: every sequence must be the same length. The canvas renderer
  // assumes a rectangular alignment (column count comes from the first row).
  const width = msa[0].sequence.length;
  const mismatch = msa.find((s) => s.sequence.length !== width);
  if (mismatch) {
    return {
      ok: false,
      error: `Sequences are not aligned: "${msa[0].identifier}" is ${width} columns but "${mismatch.identifier}" is ${mismatch.sequence.length}. All sequences must be the same length.`,
    };
  }

  return { ok: true, msa };
}

/** Parses FASTA text (tolerating a leading UTF-8 BOM) and validates it. */
export function parseAndValidateFasta(text: string): ImportResult {
  return validateMSA(parseFasta(text.replace(/^\uFEFF/, "")));
}

/** Reads, parses and validates a user-selected FASTA file. Never throws. */
export async function importFastaFile(file: File): Promise<ImportResult> {
  let text: string;
  try {
    text = await readTextFile(file);
  } catch {
    return { ok: false, error: "Could not read the file." };
  }
  return parseAndValidateFasta(text);
}
