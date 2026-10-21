import { cn } from "../utils/cn";

export interface BoardProps {
  n: number;
  onSquareClick: (idx: number) => void;
  onHoverSquare: (idx: number | null) => void;
  hoverIdx: number | null;
  knightIdx: number | null;
  /** idx -> visit order number (1-based), only squares revealed so far */
  orderOf: Map<number, number>;
  lastIdx: number | null;
  startIdx: number | null;
  legalTargets: ReadonlySet<number>;
  /** if present, shows the number of onward exits (Warnsdorff) on legal moves */
  degreeOf: Map<number, number> | null;
  hintIdx: number | null;
  rejected: { idx: number; tick: number } | null;
  /** visible path, for the SVG trail */
  path: number[];
  showClosing: boolean;
  picking: boolean;
  interactive: boolean;
  completed: boolean;
}

function point(idx: number, n: number): [number, number] {
  const r = Math.floor(idx / n);
  const c = idx % n;
  return [((c + 0.5) * 100) / n, ((r + 0.5) * 100) / n];
}

function KnightPiece({
  idx,
  n,
  ghost,
}: {
  idx: number;
  n: number;
  ghost?: boolean;
}) {
  const r = Math.floor(idx / n);
  const c = idx % n;
  return (
    <div
      className="knight-cell"
      style={{
        width: `${100 / n}%`,
        height: `${100 / n}%`,
        transform: `translate(${c * 100}%, ${r * 100}%)`,
        transitionDuration: ghost ? "0ms" : undefined,
      }}
    >
      <div key={ghost ? "ghost" : idx} className={cn("knight-glyph", ghost && "knight-ghost")}>
        {"\u265E"}
      </div>
    </div>
  );
}

export function Board({
  n,
  onSquareClick,
  onHoverSquare,
  hoverIdx,
  knightIdx,
  orderOf,
  lastIdx,
  startIdx,
  legalTargets,
  degreeOf,
  hintIdx,
  rejected,
  path,
  showClosing,
  picking,
  interactive,
  completed,
}: BoardProps) {
  const cells = [];
  for (let idx = 0; idx < n * n; idx++) {
    const r = Math.floor(idx / n);
    const c = idx % n;
    const light = (r + c) % 2 === 0;
    const order = orderOf.get(idx);
    const isLegal = legalTargets.has(idx) && order === undefined;
    cells.push(
      <div
        key={idx}
        className={cn(
          "sq",
          light ? "sq-light" : "sq-dark",
          interactive && "sq-interactive",
          picking && "sq-pick",
          startIdx === idx && "sq-start",
          hintIdx === idx && "sq-hint"
        )}
        onClick={() => onSquareClick(idx)}
        onMouseEnter={() => onHoverSquare(idx)}
        onMouseLeave={() => onHoverSquare(null)}
      >
        {c === 0 && (
          <span
            className={cn("coord coord-rank", light ? "coord-on-light" : "coord-on-dark")}
            style={{ fontSize: `${13.5 / n}cqw` }}
          >
            {n - r}
          </span>
        )}
        {r === n - 1 && (
          <span
            className={cn("coord coord-file", light ? "coord-on-light" : "coord-on-dark")}
            style={{ fontSize: `${13.5 / n}cqw` }}
          >
            {String.fromCharCode(97 + c)}
          </span>
        )}
        {isLegal &&
          (degreeOf ? (
            <span className="deg-badge" style={{ fontSize: `${22 / n}cqw` }}>
              {degreeOf.get(idx)}
            </span>
          ) : (
            <span className="legal-dot" />
          ))}
        {order !== undefined && (
          <span
            className={cn("num-chip", order === 1 && "num-start", lastIdx === idx && "num-last")}
            style={{ fontSize: `${25 / n}cqw` }}
          >
            {order}
          </span>
        )}
        {rejected?.idx === idx && <span key={rejected.tick} className="reject-flash" />}
      </div>
    );
  }

  const pts = path.map((idx) => point(idx, n));
  const pointsAttr = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <div className="board-frame">
      <div
        className="board-inner relative aspect-square w-full select-none"
        style={{ containerType: "inline-size" }}
      >
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${n}, 1fr)`,
            gridTemplateRows: `repeat(${n}, 1fr)`,
          }}
        >
          {cells}
        </div>

        <svg
          className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {pts.length >= 2 && (
            <>
              <polyline
                points={pointsAttr}
                fill="none"
                stroke="#f0cd7e"
                strokeOpacity="0.2"
                strokeWidth="7"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={pointsAttr}
                fill="none"
                stroke="#e9bd5c"
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {showClosing && first && last && (
            <line
              className="closing-line"
              x1={last[0]}
              y1={last[1]}
              x2={first[0]}
              y2={first[1]}
              stroke="#f6dfa4"
              strokeWidth="2.4"
              strokeDasharray="1.4 1.4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {picking && hoverIdx !== null && hoverIdx !== knightIdx && (
          <KnightPiece idx={hoverIdx} n={n} ghost />
        )}
        {knightIdx !== null && <KnightPiece idx={knightIdx} n={n} />}
        {completed && <div className="complete-flash" />}
      </div>
    </div>
  );
}
