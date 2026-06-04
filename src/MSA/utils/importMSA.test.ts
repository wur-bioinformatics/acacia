import { describe, it, expect } from "vitest";
import { validateMSA, parseAndValidateFasta, importFastaFile } from "./importMSA";

describe("validateMSA", () => {
  it("accepts a well-formed aligned alignment", () => {
    const msa = [
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "A--T" },
    ];
    expect(validateMSA(msa)).toEqual({ ok: true, msa });
  });

  it("rejects an empty alignment", () => {
    const result = validateMSA([]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/No sequences found/);
  });

  it("rejects an empty identifier", () => {
    const result = validateMSA([{ identifier: "", sequence: "ACGT" }]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/empty identifier/);
  });

  it("rejects duplicate identifiers and names them", () => {
    const result = validateMSA([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq1", sequence: "TGCA" },
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Duplicate sequence identifier: "seq1"/);
  });

  it("rejects an empty sequence", () => {
    const result = validateMSA([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "" },
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/"seq2" has no residues/);
  });

  it("rejects unexpected characters and reports them", () => {
    const result = validateMSA([{ identifier: "seq1", sequence: "AC1T" }]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/unexpected character: "1"/);
  });

  it("describes whitespace characters by name", () => {
    const result = validateMSA([{ identifier: "seq1", sequence: "AC GT" }]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/space/);
  });

  it("rejects sequences of differing lengths", () => {
    const result = validateMSA([
      { identifier: "seq1", sequence: "ACGT" },
      { identifier: "seq2", sequence: "ACG" },
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/not aligned/);
    expect(!result.ok && result.error).toMatch(/4 columns/);
    expect(!result.ok && result.error).toMatch(/3/);
  });

  it("allows protein residues, gaps and ambiguity codes", () => {
    const msa = [{ identifier: "p", sequence: "MNQXBZ-.*~?" }];
    expect(validateMSA(msa).ok).toBe(true);
  });
});

describe("parseAndValidateFasta", () => {
  it("parses and validates valid FASTA text", () => {
    const result = parseAndValidateFasta(">seq1\nACGT\n>seq2\nA--T\n");
    expect(result).toEqual({
      ok: true,
      msa: [
        { identifier: "seq1", sequence: "ACGT" },
        { identifier: "seq2", sequence: "A--T" },
      ],
    });
  });

  it("tolerates a leading UTF-8 BOM", () => {
    const result = parseAndValidateFasta("\uFEFF>seq1\nACGT\n");
    expect(result).toEqual({ ok: true, msa: [{ identifier: "seq1", sequence: "ACGT" }] });
  });

  it("rejects non-FASTA text with a helpful message", () => {
    const result = parseAndValidateFasta("just,a,csv\n1,2,3\n");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/No sequences found/);
  });
});

describe("importFastaFile", () => {
  it("reads, parses and validates a File", async () => {
    const file = new File([">seq1\nACGT\n>seq2\nTGCA\n"], "aln.fasta", { type: "text/plain" });
    await expect(importFastaFile(file)).resolves.toEqual({
      ok: true,
      msa: [
        { identifier: "seq1", sequence: "ACGT" },
        { identifier: "seq2", sequence: "TGCA" },
      ],
    });
  });

  it("returns a validation error for an unaligned File", async () => {
    const file = new File([">seq1\nACGT\n>seq2\nACG\n"], "aln.fasta", { type: "text/plain" });
    const result = await importFastaFile(file);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/not aligned/);
  });
});
