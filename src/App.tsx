import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./components/Board";
import { ControlPanel, type AutoPhase, type Mode } from "./components/ControlPanel";
import { StatsPanel, type StatusTone } from "./components/StatsPanel";
import { MoveLog } from "./components/MoveLog";
import { PythonPanel } from "./components/PythonPanel";
import { cn } from "./utils/cn";
import {
  algebraic,
  bestNextMove,
  closedTourPossible,
  computeNeighbors,
  solveTour,
  type SolveResult,
} from "./lib/solver";

type Tab = "panel" | "moves" | "python";
type ManualPhase = "pick" | "play" | "complete" | "stuck";
type ToastState = { id: number; msg: string; tone: "bad" | "info" | "ok" } | null;

const KNIGHT = "\u265E";

function KnightMovesDiagram() {
  const rects = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c}
          y={r}
          width={1}
          height={1}
          fill={(r + c) % 2 === 0 ? "#e9d5a7" : "#8a613c"}
        />
      );
    }
  }
  const targets = [
    [1, 0], [2, 1], [2, -1], [1, -2],
    [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];
  return (
    <svg viewBox="0 0 5 5" className="h-[104px] w-[104px] rounded-md border border-line-soft" aria-hidden="true">
      {rects}
      <path d="M2.5 2.5 H3.5 V4.5" fill="none" stroke="#f0cd7e" strokeWidth="0.14" strokeDasharray="0.28 0.2" />
      {targets.map(([dc, dr], i) => (
        <circle key={i} cx={2.5 + dc} cy={2.5 + dr} r="0.24" fill="#d3a13c" stroke="#241a06" strokeWidth="0.06" />
      ))}
      <text x="2.5" y="2.86" textAnchor="middle" fontSize="0.92" fill="#241a06">
        {KNIGHT}
      </text>
    </svg>
  );
}

export default function App() {
  // ---------------- settings ----------------
  const [n, setN] = useState(8);
  const [mode, setMode] = useState<Mode>("auto");
  const [tab, setTab] = useState<Tab>("panel");
  const [speed, setSpeed] = useState(62);
  const [wantClosed, setWantClosed] = useState(false);
  const delayMs = Math.max(20, Math.round(560 - speed * 5.4));

  // ---------------- solver mode ----------------
  const [autoPhase, setAutoPhase] = useState<AutoPhase>("idle");
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [solution, setSolution] = useState<number[] | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const [nodesExplored, setNodesExplored] = useState(0);

  // ---------------- manual mode ----------------
  const [mPath, setMPath] = useState<number[]>([]);
  const [mPhase, setMPhase] = useState<ManualPhase>("pick");
  const [showDegrees, setShowDegrees] = useState(false);
  const [hintIdx, setHintIdx] = useState<number | null>(null);

  // ---------------- shared ----------------
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [rejected, setRejected] = useState<{ idx: number; tick: number } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toursDone, setToursDone] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const runIdRef = useRef(0);
  const accRef = useRef(0);
  const t0Ref = useRef(0);
  const tickRef = useRef(0);
  const completedRef = useRef<number[] | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const neighbors = useMemo(() => computeNeighbors(n), [n]);
  const total = n * n;
  const isAuto = mode === "auto";

  // ---------------- toast ----------------
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const pushToast = (msg: string, tone: "bad" | "info" | "ok") =>
    setToast({ id: ++tickRef.current, msg, tone });

  // ---------------- resets ----------------
  const resetAuto = () => {
    runIdRef.current++;
    completedRef.current = null;
    setAutoPhase("idle");
    setStartIdx(null);
    setSolution(null);
    setResult(null);
    setDisplayCount(0);
    setNodesExplored(0);
    setElapsedMs(0);
    accRef.current = 0;
  };
  const resetManual = () => {
    setMPath([]);
    setMPhase("pick");
    setHintIdx(null);
  };
  const fullReset = () => {
    resetAuto();
    resetManual();
  };

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  // ---------------- search (async generator, chunked) ----------------
  const beginSearch = async (start: number) => {
    const id = ++runIdRef.current;
    completedRef.current = null;
    setStartIdx(start);
    setAutoPhase("searching");
    setSolution(null);
    setResult(null);
    setDisplayCount(0);
    setNodesExplored(0);
    accRef.current = 0;
    t0Ref.current = performance.now();
    setElapsedMs(0);

    const gen = solveTour(n, start, { closed: wantClosed });
    let res: SolveResult | undefined;
    for (;;) {
      const step = gen.next();
      if (runIdRef.current !== id) return;
      if (step.done) {
        res = step.value;
        break;
      }
      setNodesExplored(step.value.nodes);
      setElapsedMs(performance.now() - t0Ref.current);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (runIdRef.current !== id || !res) return;

    setResult(res);
    setNodesExplored(res.nodes);
    setElapsedMs(performance.now() - t0Ref.current);
    if (res.status === "solved") {
      setSolution(res.path);
      setDisplayCount(1);
      accRef.current = 0;
      t0Ref.current = performance.now();
      setAutoPhase("running");
    } else {
      setAutoPhase("failed");
      const msg =
        res.reason ??
        `No tour found after ${res.nodes.toLocaleString("en-US")} nodes: try again — every attempt explores a different path.`;
      pushToast(msg, "bad");
    }
  };

  // ---------------- animation ----------------
  useEffect(() => {
    if (autoPhase !== "running" || !solution || displayCount >= solution.length) return;
    const t = setTimeout(() => setDisplayCount((c) => c + 1), delayMs);
    return () => clearTimeout(t);
  }, [autoPhase, displayCount, solution, delayMs]);

  useEffect(() => {
    if (
      (autoPhase === "running" || autoPhase === "paused") &&
      solution &&
      displayCount >= solution.length
    ) {
      if (completedRef.current !== solution) {
        completedRef.current = solution;
        accRef.current += performance.now() - t0Ref.current;
        setElapsedMs(accRef.current);
        setAutoPhase("done");
        setToursDone((t) => t + 1);
        pushToast(
          result?.closed
            ? "Closed tour complete: the knight is back where it started!"
            : "Knight's tour complete!",
          "ok"
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPhase, displayCount, solution]);

  useEffect(() => {
    if (autoPhase !== "running") return;
    const id = setInterval(
      () => setElapsedMs(accRef.current + performance.now() - t0Ref.current),
      120
    );
    return () => clearInterval(id);
  }, [autoPhase]);

  // ---------------- interaction ----------------
  const rejectSquare = (idx: number, msg: string) => {
    setRejected({ idx, tick: ++tickRef.current });
    pushToast(msg, "bad");
  };

  const manualClick = (idx: number) => {
    if (mPhase === "pick" || mPhase === "complete") {
      setMPath([idx]);
      setMPhase("play");
      setHintIdx(null);
      return;
    }
    if (mPhase === "stuck") {
      pushToast("No legal moves: undo the last move.", "bad");
      return;
    }
    const current = mPath[mPath.length - 1];
    if (idx === current) return;
    const visited = new Set(mPath);
    if (visited.has(idx)) {
      rejectSquare(idx, "Square already visited: the knight passes exactly once.");
      return;
    }
    if (!neighbors[current].includes(idx)) {
      rejectSquare(idx, "Illegal move: the knight moves in an L (2+1 squares).");
      return;
    }
    const next = [...mPath, idx];
    setMPath(next);
    setHintIdx(null);
    if (next.length === total) {
      setMPhase("complete");
      setToursDone((t) => t + 1);
      pushToast("Well done: knight's tour complete!", "ok");
      return;
    }
    if (neighbors[idx].every((m) => visited.has(m))) {
      setMPhase("stuck");
      pushToast("Stuck: no way out. Undo the last move.", "bad");
    }
  };

  const handleSquareClick = (idx: number) => {
    if (isAuto) {
      if (autoPhase === "searching" || autoPhase === "running" || autoPhase === "paused") return;
      void beginSearch(idx);
    } else {
      manualClick(idx);
    }
  };

  const handlePauseResume = () => {
    if (autoPhase === "running") {
      accRef.current += performance.now() - t0Ref.current;
      setElapsedMs(accRef.current);
      setAutoPhase("paused");
    } else if (autoPhase === "paused") {
      t0Ref.current = performance.now();
      setAutoPhase("running");
    }
  };

  const handleTurbo = () => {
    if (!solution) return;
    if (autoPhase === "running") accRef.current += performance.now() - t0Ref.current;
    t0Ref.current = performance.now(); // neutralize the count in the completion effect
    setDisplayCount(solution.length);
  };

  const handleUndo = () => {
    if (mPath.length > 1) {
      setMPath((p) => p.slice(0, -1));
      setMPhase("play");
      setHintIdx(null);
    }
  };

  const handleHint = () => {
    if (mPhase !== "play" || mPath.length === 0) return;
    const best = bestNextMove(n, mPath[mPath.length - 1], new Set(mPath));
    if (best === null) {
      pushToast("No moves available.", "bad");
      return;
    }
    setHintIdx(best);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintIdx(null), 1600);
  };

  // ---------------- derived ----------------
  const visiblePath = useMemo(
    () => (isAuto ? (solution ? solution.slice(0, displayCount) : []) : mPath),
    [isAuto, solution, displayCount, mPath]
  );
  const orderOf = useMemo(() => {
    const m = new Map<number, number>();
    visiblePath.forEach((idx, i) => m.set(idx, i + 1));
    return m;
  }, [visiblePath]);

  const lastIdx = visiblePath.length > 0 ? visiblePath[visiblePath.length - 1] : null;
  const knightIdx = isAuto
    ? autoPhase === "idle" || autoPhase === "failed"
      ? null
      : lastIdx ?? startIdx
    : mPath.length > 0
      ? mPath[mPath.length - 1]
      : null;

  const legalTargets = useMemo(() => {
    if (!isAuto && mPhase === "play" && mPath.length > 0) {
      const visited = new Set(mPath);
      return new Set(neighbors[mPath[mPath.length - 1]].filter((m) => !visited.has(m)));
    }
    return new Set<number>();
  }, [isAuto, mPhase, mPath, neighbors]);

  const degreeOf = useMemo(() => {
    if (!showDegrees || legalTargets.size === 0) return null;
    const visited = new Set(mPath);
    const map = new Map<number, number>();
    for (const t of legalTargets) {
      let d = 0;
      for (const m of neighbors[t]) if (!visited.has(m)) d++;
      map.set(t, d);
    }
    return map;
  }, [showDegrees, legalTargets, mPath, neighbors]);

  const picking = isAuto
    ? autoPhase === "idle" || autoPhase === "done" || autoPhase === "failed"
    : mPhase === "pick" || mPhase === "complete";
  const interactive = isAuto ? picking : true;
  const completed = (isAuto && autoPhase === "done") || (!isAuto && mPhase === "complete");
  const showClosing =
    isAuto && autoPhase === "done" && result?.closed === true && !!solution;

  const status: { text: string; tone: StatusTone; short: string } = (() => {
    if (isAuto) {
      switch (autoPhase) {
        case "idle":
          return {
            text: "Click any square on the board: the program will search for the full tour starting there.",
            tone: "info",
            short: "Waiting",
          };
        case "searching":
          return {
            text: `Searching\u2026 ${nodesExplored.toLocaleString("en-US")} nodes explored`,
            tone: "work",
            short: "Searching\u2026",
          };
        case "running":
          return {
            text: `The knight is riding the tour: ${displayCount}/${total} squares`,
            tone: "work",
            short: "Running",
          };
        case "paused":
          return { text: "Animation paused.", tone: "info", short: "Paused" };
        case "done":
          return {
            text:
              result?.closed
                ? "Closed tour complete: the last move brings the knight back to its start!"
                : "Tour complete: every square visited exactly once.",
            tone: "ok",
            short: "Complete",
          };
        case "failed":
          return {
            text: result?.reason ?? "No tour found: try another square.",
            tone: "bad",
            short: "Failed",
          };
      }
    }
    switch (mPhase) {
      case "pick":
        return {
          text: "Choose the knight's starting square.",
          tone: "info",
          short: "Your turn",
        };
      case "play":
        return {
          text: `Your turn: ${total - mPath.length} squares left.`,
          tone: "info",
          short: "Your turn",
        };
      case "stuck":
        return {
          text: "Stuck: no legal moves left. Undo the last move.",
          tone: "bad",
          short: "Stuck",
        };
      case "complete":
        return {
          text: "Well done: you completed the knight's tour!",
          tone: "ok",
          short: "Complete",
        };
    }
  })();

  const tonePill: Record<StatusTone, string> = {
    info: "border-line text-ink-dim",
    work: "border-brass-500/50 text-brass-300",
    ok: "border-ok/50 text-ok",
    bad: "border-bad/50 text-bad",
  };
  const toneDot: Record<StatusTone, string> = {
    info: "bg-ink-faint",
    work: "bg-brass-400 dot-work",
    ok: "bg-ok",
    bad: "bg-bad",
  };

  const visitedCount = isAuto ? (autoPhase === "searching" ? 0 : displayCount) : mPath.length;

  // ---------------- render ----------------
  return (
    <div className="relative min-h-screen">
      <div
        className="glow-drift h-[420px] w-[420px] bg-brass-500/10"
        style={{ top: -120, right: -80, animation: "driftA 26s ease-in-out infinite" }}
        aria-hidden="true"
      />
      <div
        className="glow-drift h-[400px] w-[400px] bg-[#2e6944]/25"
        style={{ bottom: -140, left: -100, animation: "driftB 32s ease-in-out infinite" }}
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-20 top-[26%] z-0 select-none leading-none text-brass-400/[0.045]"
        style={{ fontSize: "46vh", transform: "rotate(8deg)" }}
      >
        {KNIGHT}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-4 pb-10 pt-6 lg:px-8">
        {/* ---------- header ---------- */}
        <header className="rise mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative grid h-14 w-14 flex-none place-items-center rounded-full border-2 border-brass-500/70 bg-[radial-gradient(circle_at_35%_30%,#24402d,#0c1a11_70%)] shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <span className="text-[30px] leading-none text-brass-300 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">
                {KNIGHT}
              </span>
              {(autoPhase === "searching" || autoPhase === "running") && (
                <svg
                  className="absolute -inset-1.5"
                  viewBox="0 0 100 100"
                  style={{ animation: "spinSlow 7s linear infinite" }}
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="rgba(230,185,84,0.55)"
                    strokeWidth="2"
                    strokeDasharray="14 10"
                  />
                </svg>
              )}
            </div>
            <div>
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-[0.04em] text-ink sm:text-[30px]">
                The Knight&rsquo;s <span className="text-brass-300">Tour</span>
              </h1>
              <p className="text-[12.5px] font-medium tracking-wide text-ink-faint">
                The knight&rsquo;s tour problem · every square exactly once · Warnsdorff, 1823
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border bg-black/25 px-3.5 py-1.5 text-[12px] font-bold tracking-wide",
              tonePill[status.tone]
            )}
          >
            <span className={cn("status-dot", toneDot[status.tone])} />
            {status.short}
          </div>
        </header>

        {/* ---------- body ---------- */}
        <main className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="rise" style={{ animationDelay: "70ms" }}>
            <div className="mx-auto w-full max-w-[660px]">
              <Board
                n={n}
                onSquareClick={handleSquareClick}
                onHoverSquare={setHoverIdx}
                hoverIdx={hoverIdx}
                knightIdx={knightIdx}
                orderOf={orderOf}
                lastIdx={lastIdx}
                startIdx={isAuto ? startIdx : mPath.length > 0 ? mPath[0] : null}
                legalTargets={legalTargets}
                degreeOf={degreeOf}
                hintIdx={hintIdx}
                rejected={rejected}
                path={visiblePath}
                showClosing={showClosing}
                picking={picking}
                interactive={interactive}
                completed={completed}
              />
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold tracking-wide text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className="inline-grid h-4 w-4 place-items-center rounded-[4px] bg-gradient-to-b from-[#ecc363] to-[#c3922f] font-mono text-[9px] font-bold text-[#241a06]">
                    1
                  </span>
                  start
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-grid h-4 w-4 place-items-center rounded-[4px] border border-brass-500/40 bg-[#0d150b]/85 font-mono text-[9px] font-bold text-brass-300">
                    7
                  </span>
                  visit no.
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-[radial-gradient(circle_at_35%_30%,#f6dfa4,#d3a13c_60%,#96702a)]" />
                  legal move
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-4 w-4 rounded-[4px] shadow-[inset_0_0_0_2px_rgba(240,205,126,0.9)]" />
                  hint
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-5 rounded bg-brass-400" />
                  path
                </span>
              </div>
            </div>
          </section>

          <aside className="rise flex min-h-0 flex-col gap-3" style={{ animationDelay: "140ms" }}>
            <nav className="panel flex gap-1 px-2 py-1">
              {(
                [
                  ["panel", "Panel"],
                  ["moves", `Moves${visiblePath.length > 0 ? ` \u00B7 ${visiblePath.length}` : ""}`],
                  ["python", "Python"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={cn("tab-btn", tab === id && "tab-on")}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === "panel" && (
              <div className="flex flex-col gap-4">
                <ControlPanel
                  mode={mode}
                  onModeChange={(m) => {
                    setMode(m);
                    fullReset();
                  }}
                  n={n}
                  onSizeChange={(nn) => {
                    setN(nn);
                    fullReset();
                  }}
                  speed={speed}
                  onSpeedChange={setSpeed}
                  delayMs={delayMs}
                  wantClosed={wantClosed}
                  onWantClosedChange={(v) => {
                    setWantClosed(v);
                    if (isAuto) resetAuto();
                  }}
                  closedPossible={closedTourPossible(n)}
                  autoPhase={autoPhase}
                  onRandomStart={() => void beginSearch(Math.floor(Math.random() * total))}
                  onPauseResume={handlePauseResume}
                  onTurbo={handleTurbo}
                  onAutoRestart={resetAuto}
                  onUndo={handleUndo}
                  onHint={handleHint}
                  onManualRestart={resetManual}
                  showDegrees={showDegrees}
                  onShowDegreesChange={setShowDegrees}
                  canUndo={mPath.length > 1 && mPhase !== "pick"}
                  canHint={mPhase === "play"}
                />
                <StatsPanel
                  n={n}
                  visited={visitedCount}
                  lastSquare={lastIdx !== null ? algebraic(lastIdx, n) : null}
                  nodes={isAuto && autoPhase !== "idle" ? nodesExplored : null}
                  elapsedMs={isAuto && autoPhase !== "idle" ? elapsedMs : null}
                  toursDone={toursDone}
                  statusText={status.text}
                  statusTone={status.tone}
                />
              </div>
            )}

            {tab === "moves" && (
              <MoveLog
                n={n}
                path={visiblePath}
                emptyText={
                  isAuto
                    ? "The log will fill up once the knight starts its tour: pick a starting square."
                    : "Your moves will appear here: pick a starting square."
                }
                completed={completed}
              />
            )}

            {tab === "python" && <PythonPanel />}
          </aside>
        </main>

        {/* ---------- footer ---------- */}
        <footer className="rise mt-8 grid gap-4 md:grid-cols-3" style={{ animationDelay: "210ms" }}>
          <section className="panel p-4">
            <h3 className="panel-title mb-2">Warnsdorff&rsquo;s rule</h3>
            <p className="text-[12.5px] leading-relaxed text-ink-dim">
              At each step the knight picks, among its legal moves, the square with the{" "}
              <strong className="text-brass-300">fewest onward exits</strong>. This greedy
              rule, published by H. C. von Warnsdorff in 1823, completes the tour almost
              always on the first try; here it is reinforced with{" "}
              <strong className="text-brass-300">limited backtracking</strong>, which
              guarantees a solution whenever one exists.
            </p>
          </section>
          <section className="panel p-4">
            <h3 className="panel-title mb-2">The legal moves</h3>
            <div className="flex gap-3.5">
              <KnightMovesDiagram />
              <p className="text-[12.5px] leading-relaxed text-ink-dim">
                The knight moves <strong className="text-brass-300">in an L</strong>: two
                squares in one direction and one perpendicular, leaping over any piece.
                From central squares it has 8 destinations, from a corner only 2.
              </p>
            </div>
          </section>
          <section className="panel p-4">
            <h3 className="panel-title mb-2">When does a tour exist?</h3>
            <p className="text-[12.5px] leading-relaxed text-ink-dim">
              <strong className="text-brass-300">Open</strong> tour: exists for every N ≥ 5,
              but on odd boards it can only start from the corner color (the knight
              changes color at every move). <strong className="text-brass-300">Closed</strong>{" "}
              tour (the knight returns to its start): by Schwenk&rsquo;s theorem N must be
              even and ≥ 6 — impossible on 7×7 or 9×9.
            </p>
          </section>
        </footer>
      </div>

      {/* ---------- toast ---------- */}
      {toast && (
        <div
          key={toast.id}
          className={cn(
            "toast fixed bottom-6 left-1/2 z-50 max-w-[92vw] rounded-xl border px-4 py-2.5 text-[13px] font-bold shadow-[0_16px_40px_rgba(0,0,0,0.5)]",
            toast.tone === "bad" && "border-bad/50 bg-[#331511]/95 text-[#f2a49c]",
            toast.tone === "ok" && "border-ok/50 bg-[#12291a]/95 text-ok",
            toast.tone === "info" && "border-brass-500/50 bg-[#2a2210]/95 text-brass-200"
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
