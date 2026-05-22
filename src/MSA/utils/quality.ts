import type { MSAData, SequenceType } from "../types";

export type SubMatrix = Record<string, Record<string, number>>;

// NCBI BLOSUM62 — 24 residues including ambiguity codes (B, Z, X, *)
export const BLOSUM62: SubMatrix = (() => {
  const residues = "ARNDCQEGHILKMFPSTWYVBZX*";
  // prettier-ignore
  const rows: number[][] = [
    [ 4,-1,-2,-2, 0,-1,-1, 0,-2,-1,-1,-1,-1,-2,-1, 1, 0,-3,-2, 0,-2,-1, 0,-4], // A
    [-1, 5, 0,-2,-3, 1, 0,-2, 0,-3,-2, 2,-1,-3,-2,-1,-1,-3,-2,-3,-1, 0,-1,-4], // R
    [-2, 0, 6, 1,-3, 0, 0, 0, 1,-3,-3, 0,-2,-3,-2, 1, 0,-4,-2,-3, 3, 0,-1,-4], // N
    [-2,-2, 1, 6,-3, 0, 2,-1,-1,-3,-4,-1,-3,-3,-1, 0,-1,-4,-3,-3, 4, 1,-1,-4], // D
    [ 0,-3,-3,-3, 9,-3,-4,-3,-3,-1,-1,-3,-1,-2,-3,-1,-1,-2,-2,-1,-3,-3,-2,-4], // C
    [-1, 1, 0, 0,-3, 5, 2,-2, 0,-3,-2, 1, 0,-3,-1, 0,-1,-2,-1,-2, 0, 3,-1,-4], // Q
    [-1, 0, 0, 2,-4, 2, 5,-2, 0,-3,-3, 1,-2,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4], // E
    [ 0,-2, 0,-1,-3,-2,-2, 6,-2,-4,-4,-2,-3,-3,-2, 0,-2,-2,-3,-3,-1,-2,-1,-4], // G
    [-2, 0, 1,-1,-3, 0, 0,-2, 8,-3,-3,-1,-2,-1,-2,-1,-2,-2, 2,-3, 0, 0,-1,-4], // H
    [-1,-3,-3,-3,-1,-3,-3,-4,-3, 4, 2,-3, 1, 0,-3,-2,-1,-3,-1, 3,-3,-3,-1,-4], // I
    [-1,-2,-3,-4,-1,-2,-3,-4,-3, 2, 4,-2, 2, 0,-3,-2,-1,-2,-1, 1,-4,-3,-1,-4], // L
    [-1, 2, 0,-1,-3, 1, 1,-2,-1,-3,-2, 5,-1,-3,-1, 0,-1,-3,-2,-2, 0, 1,-1,-4], // K
    [-1,-1,-2,-3,-1, 0,-2,-3,-2, 1, 2,-1, 5, 0,-2,-1,-1,-1,-1, 1,-3,-1,-1,-4], // M
    [-2,-3,-3,-3,-2,-3,-3,-3,-1, 0, 0,-3, 0, 6,-4,-2,-2, 1, 3,-1,-3,-3,-1,-4], // F
    [-1,-2,-2,-1,-3,-1,-1,-2,-2,-3,-3,-1,-2,-4, 7,-1,-1,-4,-3,-2,-2,-1,-2,-4], // P
    [ 1,-1, 1, 0,-1, 0, 0, 0,-1,-2,-2, 0,-1,-2,-1, 4, 1,-3,-2,-2, 0, 0, 0,-4], // S
    [ 0,-1, 0,-1,-1,-1,-1,-2,-2,-1,-1,-1,-1,-2,-1, 1, 5,-2,-2, 0,-1,-1, 0,-4], // T
    [-3,-3,-4,-4,-2,-2,-3,-2,-2,-3,-2,-3,-1, 1,-4,-3,-2,11, 2,-3,-4,-3,-2,-4], // W
    [-2,-2,-2,-3,-2,-1,-2,-3, 2,-1,-1,-2,-1, 3,-3,-2,-2, 2, 7,-1,-3,-2,-1,-4], // Y
    [ 0,-3,-3,-3,-1,-2,-2,-3,-3, 3, 1,-2, 1,-1,-2,-2, 0,-3,-1, 4,-3,-2,-1,-4], // V
    [-2,-1, 3, 4,-3, 0, 1,-1, 0,-3,-4, 0,-3,-3,-2, 0,-1,-4,-3,-3, 4, 1,-1,-4], // B
    [-1, 0, 0, 1,-3, 3, 4,-2, 0,-3,-3, 1,-1,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4], // Z
    [ 0,-1,-1,-1,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-2, 0, 0,-2,-1,-1,-1,-1,-1,-4], // X
    [-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4, 1], // *
  ];
  const m: SubMatrix = {};
  for (let i = 0; i < residues.length; i++) {
    const ri: Record<string, number> = {};
    for (let j = 0; j < residues.length; j++) ri[residues[j]] = rows[i][j];
    m[residues[i]] = ri;
  }
  return m;
})();

// BLASTN-style DNA scoring. U treated as T.
export const DNA_MATRIX: SubMatrix = (() => {
  const bases = "ACGTUN";
  const m: SubMatrix = {};
  for (const a of bases) {
    m[a] = {};
    for (const b of bases) {
      const aa = a === "U" ? "T" : a;
      const bb = b === "U" ? "T" : b;
      if (aa === "N" || bb === "N") m[a][b] = -2;
      else m[a][b] = aa === bb ? 5 : -4;
    }
  }
  return m;
})();

/** Scoring matrix, affine gap penalties, and alphabet size per sequence type. */
export const SCORING_PARAMS: Record<
  SequenceType,
  { matrix: SubMatrix; gapOpen: number; gapExtend: number; alphabetSize: number }
> = {
  Protein: { matrix: BLOSUM62, gapOpen: -11, gapExtend: -1, alphabetSize: 20 },
  DNA: { matrix: DNA_MATRIX, gapOpen: -10, gapExtend: -1, alphabetSize: 4 },
};

/** Upper-triangular flat index for unordered pair (i, j) with i < j, 0-based. */
export function pairIndex(i: number, j: number, n: number): number {
  if (i === j) throw new Error("pairIndex requires i !== j");
  const a = i < j ? i : j;
  const b = i < j ? j : i;
  return (a * (2 * n - a - 1)) / 2 + (b - a - 1);
}

/** Build a flat 256x256 substitution lookup keyed by ASCII char codes. */
export function buildLookup(matrix: SubMatrix, fallback = -4): Int8Array {
  const lookup = new Int8Array(256 * 256);
  lookup.fill(fallback);
  for (const [a, row] of Object.entries(matrix)) {
    const ac = a.charCodeAt(0);
    for (const [b, v] of Object.entries(row)) lookup[ac * 256 + b.charCodeAt(0)] = v;
  }
  return lookup;
}

/** Compute min/max over all matrix entries. */
export function matrixRange(matrix: SubMatrix): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const row of Object.values(matrix)) {
    for (const v of Object.values(row)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min, max };
}

/** Strip gaps, uppercase residues, and record per-column ungapped index ('-' → -1). */
export function stripGapsAndIndex(seq: string): { ungapped: string; idx: Int32Array } {
  const idx = new Int32Array(seq.length);
  let out = "";
  for (let c = 0; c < seq.length; c++) {
    const ch = seq[c];
    if (ch === "-") {
      idx[c] = -1;
    } else {
      idx[c] = out.length;
      out += ch.toUpperCase();
    }
  }
  return { ungapped: out, idx };
}

/**
 * Needleman-Wunsch global alignment with Gotoh affine gaps.
 * Returns Int32Array of length seqA.length: entry[posA] = posB it aligns to, or -1 if A[posA] is in a gap.
 * gapOpen and gapExtend are negative penalties (e.g. -11, -1).
 */
export function needlemanWunsch(
  seqA: string,
  seqB: string,
  lookup: Int8Array,
  gapOpen: number,
  gapExtend: number,
): Int32Array {
  const m = seqA.length;
  const n = seqB.length;
  if (m === 0) return new Int32Array(0);
  if (n === 0) return new Int32Array(m).fill(-1);

  const W = n + 1;
  const NEG = -1_000_000_000;
  const M = new Int32Array((m + 1) * W);
  const Ix = new Int32Array((m + 1) * W);
  const Iy = new Int32Array((m + 1) * W);
  // Traceback: 0 = came from M, 1 = from Ix, 2 = from Iy
  const tbM = new Uint8Array((m + 1) * W);
  const tbIx = new Uint8Array((m + 1) * W);
  const tbIy = new Uint8Array((m + 1) * W);

  M[0] = 0;
  Ix[0] = NEG;
  Iy[0] = NEG;
  for (let i = 1; i <= m; i++) {
    const idx = i * W;
    M[idx] = NEG;
    Ix[idx] = gapOpen + (i - 1) * gapExtend;
    Iy[idx] = NEG;
    tbIx[idx] = i === 1 ? 0 : 1;
  }
  for (let j = 1; j <= n; j++) {
    M[j] = NEG;
    Ix[j] = NEG;
    Iy[j] = gapOpen + (j - 1) * gapExtend;
    tbIy[j] = j === 1 ? 0 : 2;
  }

  for (let i = 1; i <= m; i++) {
    const aCode = seqA.charCodeAt(i - 1);
    const rowBase = aCode * 256;
    const rowIdx = i * W;
    const prevRowIdx = (i - 1) * W;
    for (let j = 1; j <= n; j++) {
      const bCode = seqB.charCodeAt(j - 1);
      const sub = lookup[rowBase + bCode];

      const idx = rowIdx + j;
      const diag = prevRowIdx + (j - 1);

      // M[i][j]
      let bestM = M[diag];
      let srcM = 0;
      if (Ix[diag] > bestM) {
        bestM = Ix[diag];
        srcM = 1;
      }
      if (Iy[diag] > bestM) {
        bestM = Iy[diag];
        srcM = 2;
      }
      M[idx] = sub + bestM;
      tbM[idx] = srcM;

      // Ix[i][j]: gap in B, consume A
      const upIdx = prevRowIdx + j;
      const xOpen = M[upIdx] + gapOpen;
      const xExt = Ix[upIdx] + gapExtend;
      if (xOpen >= xExt) {
        Ix[idx] = xOpen;
        tbIx[idx] = 0;
      } else {
        Ix[idx] = xExt;
        tbIx[idx] = 1;
      }

      // Iy[i][j]: gap in A, consume B
      const leftIdx = rowIdx + (j - 1);
      const yOpen = M[leftIdx] + gapOpen;
      const yExt = Iy[leftIdx] + gapExtend;
      if (yOpen >= yExt) {
        Iy[idx] = yOpen;
        tbIy[idx] = 0;
      } else {
        Iy[idx] = yExt;
        tbIy[idx] = 2;
      }
    }
  }

  // Pick the best final state
  const last = m * W + n;
  let state: 0 | 1 | 2 = 0;
  let best = M[last];
  if (Ix[last] > best) {
    best = Ix[last];
    state = 1;
  }
  if (Iy[last] > best) {
    state = 2;
  }

  const posAToPosB = new Int32Array(m).fill(-1);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const idx = i * W + j;
    if (state === 0) {
      posAToPosB[i - 1] = j - 1;
      const src = tbM[idx];
      i--;
      j--;
      state = src as 0 | 1 | 2;
    } else if (state === 1) {
      const src = tbIx[idx];
      i--;
      state = src === 0 ? 0 : 1;
    } else {
      const src = tbIy[idx];
      j--;
      state = src === 0 ? 0 : 2;
    }
  }
  return posAToPosB;
}

/**
 * Build a pairwise NW global-alignment library. Result is indexed by `pairIndex(i, j, N)`;
 * each entry maps ungapped positions of the lower-index sequence to ungapped positions of the higher-index sequence.
 */
export function buildPairwiseLibrary(
  ungapped: string[],
  lookup: Int8Array,
  gapOpen: number,
  gapExtend: number,
  onProgress?: (current: number, total: number) => void,
): Int32Array[] {
  const N = ungapped.length;
  const total = (N * (N - 1)) / 2;
  const library: Int32Array[] = new Array(total);
  if (total === 0) return library;
  const stride = Math.max(1, Math.floor(total / 20));
  let done = 0;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      library[pairIndex(i, j, N)] = needlemanWunsch(ungapped[i], ungapped[j], lookup, gapOpen, gapExtend);
      done++;
      if (onProgress && (done % stride === 0 || done === total)) onProgress(done, total);
    }
  }
  return library;
}

/**
 * Per-residue TCS: for each non-gap cell (row, col), the fraction of other non-gap residues
 * in the same column whose pairwise NW library aligns the two together. Gap cells score 0.
 * A residue with no other non-gap residue in its column scores 1 (no disagreement possible).
 */
export function computeTcsFromLibrary(
  msaData: MSAData,
  ungappedIdx: Int32Array[],
  library: Int32Array[],
  onProgress?: (current: number, total: number) => void,
): number[][] {
  const N = msaData.length;
  if (N === 0) return [];
  const L = msaData[0].sequence.length;
  const result: number[][] = Array.from({ length: N }, () => new Array<number>(L).fill(0));
  const stride = Math.max(1, Math.floor(L / 20));
  const consistent = new Int32Array(N);
  const total = new Int32Array(N);

  for (let c = 0; c < L; c++) {
    const rows: number[] = [];
    for (let r = 0; r < N; r++) if (msaData[r].sequence[c] !== "-") rows.push(r);

    if (rows.length === 0) {
      if (onProgress && ((c + 1) % stride === 0 || c === L - 1)) onProgress(c + 1, L);
      continue;
    }

    // Reset counters for the rows we'll touch
    for (const r of rows) {
      consistent[r] = 0;
      total[r] = 0;
    }

    for (let a = 0; a < rows.length; a++) {
      const ri = rows[a];
      const posRi = ungappedIdx[ri][c];
      for (let b = a + 1; b < rows.length; b++) {
        const rj = rows[b];
        const posRj = ungappedIdx[rj][c];
        const lib = library[pairIndex(ri, rj, N)];
        if (lib[posRi] === posRj) {
          consistent[ri]++;
          consistent[rj]++;
        }
        total[ri]++;
        total[rj]++;
      }
    }

    for (const r of rows) {
      result[r][c] = total[r] === 0 ? 1 : consistent[r] / total[r];
    }

    if (onProgress && ((c + 1) % stride === 0 || c === L - 1)) onProgress(c + 1, L);
  }
  return result;
}

/** Column-aggregate TCS: mean over non-gap residues. All-gap columns score 0. */
export function computeTcsColumnMeans(msaData: MSAData, tcs: number[][]): number[] {
  const N = msaData.length;
  if (N === 0) return [];
  const L = msaData[0].sequence.length;
  const means = new Array<number>(L).fill(0);
  for (let c = 0; c < L; c++) {
    let sum = 0;
    let count = 0;
    for (let r = 0; r < N; r++) {
      if (msaData[r].sequence[c] !== "-") {
        sum += tcs[r][c];
        count++;
      }
    }
    means[c] = count === 0 ? 0 : sum / count;
  }
  return means;
}

/**
 * TRIDENT per-column score: C × R × G.
 *  - C(j) = 1 − H(j) / log2(K)  (normalized Shannon entropy)
 *  - R(j) = (mean pairwise substitution score − m_min) / (m_max − m_min)
 *  - G(j) = 1 − ngap(j) / N
 * All-gap columns return 0.
 */
export function computeTrident(msaData: MSAData, matrix: SubMatrix, alphabetSize: number): number[] {
  const N = msaData.length;
  if (N === 0) return [];
  const L = msaData[0].sequence.length;
  const { min: mMin, max: mMax } = matrixRange(matrix);
  const mRange = mMax - mMin;
  const logK = Math.log2(alphabetSize);
  const scores = new Array<number>(L);

  for (let c = 0; c < L; c++) {
    const counts: Record<string, number> = {};
    let gapCount = 0;
    for (let r = 0; r < N; r++) {
      const ch = msaData[r].sequence[c];
      if (ch === "-") {
        gapCount++;
      } else {
        const u = ch.toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
      }
    }
    const nonGap = N - gapCount;
    const G = 1 - gapCount / N;

    if (nonGap === 0) {
      scores[c] = 0;
      continue;
    }

    let H = 0;
    for (const n of Object.values(counts)) {
      const p = n / nonGap;
      if (p > 0) H -= p * Math.log2(p);
    }
    const C = logK > 0 ? Math.max(0, Math.min(1, 1 - H / logK)) : 1;

    let R: number;
    if (nonGap <= 1 || mRange === 0) {
      R = 1;
    } else {
      let scoreSum = 0;
      let pairCount = 0;
      const entries = Object.entries(counts);
      for (let i = 0; i < entries.length; i++) {
        const [ai, ci] = entries[i];
        const self = (ci * (ci - 1)) / 2;
        if (self > 0) {
          scoreSum += self * (matrix[ai]?.[ai] ?? 0);
          pairCount += self;
        }
        for (let j = i + 1; j < entries.length; j++) {
          const [aj, cj] = entries[j];
          const cross = ci * cj;
          const v = matrix[ai]?.[aj] ?? matrix[aj]?.[ai] ?? 0;
          scoreSum += cross * v;
          pairCount += cross;
        }
      }
      const mean = pairCount === 0 ? 0 : scoreSum / pairCount;
      R = Math.max(0, Math.min(1, (mean - mMin) / mRange));
    }

    scores[c] = C * R * G;
  }
  return scores;
}
