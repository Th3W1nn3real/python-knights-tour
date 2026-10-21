/**
 * Solver for the Knight's Tour.
 *
 * Strategy: Warnsdorff's rule (1823) — among the knight's legal moves,
 * explore first the square with the fewest onward exits — reinforced
 * with budget-limited backtracking, so a solution is guaranteed
 * whenever one exists.
 */

export const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const neighborCache = new Map<number, number[][]>();

/** Legal knight moves (flat indices) for every square of an n×n board. */
export function computeNeighbors(n: number): number[][] {
  const cached = neighborCache.get(n);
  if (cached) return cached;
  const lists: number[][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const out: number[] = [];
      for (const [dc, dr] of KNIGHT_DELTAS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) out.push(nr * n + nc);
      }
      lists.push(out);
    }
  }
  neighborCache.set(n, lists);
  return lists;
}

export function rowOf(idx: number, n: number): number {
  return Math.floor(idx / n);
}
export function colOf(idx: number, n: number): number {
  return idx % n;
}

/** Algebraic notation: file a… + rank (1 at the bottom). */
export function algebraic(idx: number, n: number): string {
  return String.fromCharCode(97 + colOf(idx, n)) + String(n - rowOf(idx, n));
}

/**
 * Schwenk's theorem (square n×n board): a CLOSED tour exists
 * if and only if n is even and n ≥ 6.
 */
export function closedTourPossible(n: number): boolean {
  return n % 2 === 0 && n >= 6;
}

export interface SolveProgress {
  nodes: number;
  depth: number;
}

export interface SolveResult {
  status: "solved" | "exhausted" | "budget" | "impossible";
  path: number[];
  nodes: number;
  closed: boolean;
  reason?: string;
}

export interface SolveOptions {
  closed: boolean;
  nodeLimit?: number;
}

/**
 * Generator that solves the knight's tour. Every ~1024 nodes it `yield`s
 * progress so the interface stays alive during the search; when finished
 * it returns the complete result.
 *
 * Phase 1 — randomized greedy attempts: at each step, pick at random among
 *           the legal moves with the fewest onward exits (Warnsdorff):
 *           every attempt is a different path, and almost always a winning
 *           one. For closed tours the last move is constrained to a square
 *           attacking the start; if the start is a corner, its other
 *           neighbor is reserved as the final move.
 * Phase 2 — budget-limited backtracking (open tours only), for completeness.
 */
export function* solveTour(
  n: number,
  start: number,
  options: SolveOptions
): Generator<SolveProgress, SolveResult, void> {
  const nodeLimit = options.nodeLimit ?? 400_000;
  const total = n * n;

  if (options.closed && !closedTourPossible(n)) {
    return {
      status: "impossible",
      path: [start],
      nodes: 0,
      closed: true,
      reason: `On an ${n}×${n} board a closed tour cannot exist (Schwenk's theorem): try an open tour, or an even N ≥ 6.`,
    };
  }

  const neigh = computeNeighbors(n);
  const adjToStart = new Uint8Array(total);
  for (const m of neigh[start]) adjToStart[m] = 1;

  // On an odd board the two colors occur in different numbers: the knight
  // alternates colors on every move, so the tour can only start from a
  // square of the majority color (the color of the corners).
  if (total % 2 === 1) {
    const r = Math.floor(start / n);
    const c = start % n;
    if ((r + c) % 2 === 1) {
      return {
        status: "impossible",
        path: [start],
        nodes: 0,
        closed: options.closed,
        reason: `On an odd board (${n}×${n}) the tour can only start from a square of the corner color: the knight changes color at every move, and squares of the other color are one fewer.`,
      };
    }
  }

  let nodes = 0;
  const isCorner = neigh[start].length === 2;

  // ---------------- Phase 1: greedy Warnsdorff with restarts ----------------
  const maxAttempts = options.closed ? 6000 : 300;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = new Int32Array(total).fill(-1);
    grid[start] = 0;
    const path: number[] = [start];
    let reserved = -1;
    if (options.closed && isCorner) {
      // Corner start: second square is one of the two neighbors (at random),
      // the other neighbor is RESERVED as the closing move.
      const nbs = neigh[start];
      const s2 = nbs[(Math.random() * nbs.length) | 0];
      reserved = nbs[0] === s2 ? nbs[1] : nbs[0];
      grid[s2] = 1;
      path.push(s2);
    }
    let failed = false;

    while (path.length < total) {
      const cur = path[path.length - 1];
      const isLastStep = path.length === total - 1;
      let pool: number[] = [];
      let poolDeg = Infinity;
      for (const m of neigh[cur]) {
        if (grid[m] !== -1) continue;
        if (options.closed) {
          if (isCorner) {
            if (m === reserved && !isLastStep) continue;
            if (isLastStep && m !== reserved) continue;
          } else if (isLastStep && !adjToStart[m]) {
            continue;
          }
        }
        let d = 0;
        for (const mm of neigh[m]) if (grid[mm] === -1 && mm !== reserved) d++;
        // Non-corner closed tour: neighbors of the start count one extra
        // "reserved" exit, so they are saved for the finale.
        if (options.closed && !isCorner && !isLastStep && adjToStart[m]) d++;
        if (d < poolDeg) {
          poolDeg = d;
          pool = [m];
        } else if (d === poolDeg) {
          pool.push(m);
        }
      }
      if (pool.length === 0) {
        failed = true;
        break;
      }
      const m = pool[(Math.random() * pool.length) | 0];
      grid[m] = path.length;
      path.push(m);
      nodes++;
      if ((nodes & 1023) === 0) yield { nodes, depth: path.length };
      if (nodes >= nodeLimit) {
        return { status: "budget", path: path.slice(), nodes, closed: options.closed };
      }
    }

    if (!failed) {
      return { status: "solved", path, nodes, closed: options.closed };
    }
  }

  if (options.closed) {
    return { status: "budget", path: [start], nodes, closed: true };
  }

  // ---------------- Phase 2: budget-limited backtracking (open tour) ----------------
  const grid = new Int32Array(total).fill(-1);
  grid[start] = 0;
  const path: number[] = [start];

  const degree = (idx: number): number => {
    let d = 0;
    for (const m of neigh[idx]) if (grid[m] === -1) d++;
    return d;
  };

  const buildOptions = (): number[] => {
    const cur = path[path.length - 1];
    const opts: number[] = [];
    for (const m of neigh[cur]) {
      if (grid[m] !== -1) continue;
      opts.push(m);
    }
    opts.sort((a, b) => degree(a) - degree(b) || Math.random() - 0.5);
    opts.reverse(); // the stack consumes from the end: lowest degree comes out first
    return opts;
  };

  const stack: number[][] = [buildOptions()];

  for (;;) {
    if (path.length === total) {
      return { status: "solved", path: path.slice(), nodes, closed: false };
    }
    const top = stack[stack.length - 1];
    if (top.length > 0) {
      const m = top.pop()!;
      grid[m] = path.length;
      path.push(m);
      stack.push(buildOptions());
    } else {
      stack.pop();
      if (stack.length === 0) {
        return { status: "exhausted", path: path.slice(), nodes, closed: false };
      }
      const back = path.pop()!;
      grid[back] = -1;
    }
    nodes++;
    if ((nodes & 1023) === 0) yield { nodes, depth: path.length };
    if (nodes >= nodeLimit) {
      return { status: "budget", path: path.slice(), nodes, closed: false };
    }
  }
}

/**
 * Hint for manual mode: among the legal, still-unvisited moves, pick the
 * one with the fewest onward exits (pure Warnsdorff).
 */
export function bestNextMove(
  n: number,
  current: number,
  visited: ReadonlySet<number>
): number | null {
  const neigh = computeNeighbors(n);
  let best: number | null = null;
  let bestDeg = Infinity;
  for (const m of neigh[current]) {
    if (visited.has(m)) continue;
    let d = 0;
    for (const mm of neigh[m]) if (!visited.has(mm)) d++;
    if (d < bestDeg || (d === bestDeg && Math.random() < 0.5)) {
      bestDeg = d;
      best = m;
    }
  }
  return best;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
