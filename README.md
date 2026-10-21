# ♞ The Knight's Tour

An interactive solver for the classic **knight's tour** problem: place the knight on any
square of a chessboard and watch it visit **every square exactly once**, moving only in
legal L-shaped jumps. Ships as both a rich web app (React + TypeScript) and a standalone
**Python program with an integrated tkinter GUI**.

[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-3776ab?logo=python&logoColor=white)](knights_tour.py)
[![React 19](https://img.shields.io/badge/react-19-61dafb?logo=react&logoColor=white)](package.json)
[![Vite 7](https://img.shields.io/badge/vite-7-646cff?logo=vite&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-d3a13c)](LICENSE)

```
 1 10 21 16  7        A real 5×5 tour found by the solver,
20 15  8 11 22        starting from the corner (a5):
 9  2 25  6 17        25 squares, 24 legal knight moves,
14 19  4 23 12        each square visited exactly once.
 3 24 13 18  5
```

## The web app

Click a square — the program searches for a complete tour from there and animates it on
the board, numbering every visit and drawing the golden trail.

- **Solver mode** — click any square (or *Random start*), then sit back: animated knight,
  adjustable speed, *Pause / Resume*, *Turbo*, and an optional **closed tour** (the last
  move returns to the starting square).
- **Manual play** — ride the knight yourself: golden dots mark every legal L-move, illegal
  moves are rejected with feedback, with *Undo*, *Suggest move* (Warnsdorff hint) and an
  optional overlay showing each move's number of onward exits.
- **Boards from 5×5 to 10×10**, live stats (nodes explored, time, coverage bar), an
  algebraic-notation move log with copy-to-clipboard, and a built-in tab that displays,
  copies and downloads the Python version of the program.
- Mathematically honest: impossible requests are detected instantly and *explained* —
  Schwenk's theorem for closed tours, and the corner-color parity rule on odd boards.

### Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → self-contained dist/index.html
```

The build is a **single HTML file** (vite-plugin-singlefile): host it anywhere, or just
open it. A GitHub Pages workflow is included in `.github/workflows/pages.yml` — enable
Pages in the repository settings and every push to `main` deploys automatically.

## The Python program

[`knights_tour.py`](knights_tour.py) is a complete, standalone version with an integrated
GUI — **standard library only** (tkinter), no dependencies to install:

```bash
python knights_tour.py
```

Click a square to choose the starting point; the search runs in chunks so the window
stays responsive, then the knight animates across the board. Board size 5–10, speed
slider, pause/resume.

## How it works

The engine combines three ideas:

1. **Warnsdorff's rule (1823)** — always move the knight to the square with the *fewest
   onward exits*. This greedy heuristic completes a tour almost always on the first try.
2. **Randomized restarts** — ties are broken at random, so every attempt explores a
   different tour. For *closed* tours the last move is constrained to a square attacking
   the start; if the start is a corner, its other neighbor is reserved as the closing move.
3. **Budget-limited backtracking** — a safety net that keeps the search complete: a
   solution is guaranteed whenever one exists, and impossibility is detected by theory
   instead of brute force:
   - **Closed tours** (Schwenk's theorem): exist on N×N only for even N ≥ 6.
   - **Odd boards**: the knight alternates square colors, so a tour can only start from
     the majority color — the color of the corners.

The solver was verified exhaustively: every legal starting square on every board size
5–10, open and closed — worst case runs in a few milliseconds.

## Project structure

```
├── knights_tour.py              # standalone Python + tkinter program
├── src/
│   ├── App.tsx                  # state machine, layout, header/footer
│   ├── components/
│   │   ├── Board.tsx            # chessboard, knight piece, SVG trail
│   │   ├── ControlPanel.tsx     # mode, board size, speed, actions
│   │   ├── StatsPanel.tsx       # status, coverage, live counters
│   │   ├── MoveLog.tsx          # algebraic move log + copy
│   │   └── PythonPanel.tsx      # highlights / copies / downloads knights_tour.py
│   └── lib/
│       ├── solver.ts            # Warnsdorff + restarts + backtracking engine
│       └── pythonSource.ts      # the Python program embedded as a string
└── .github/workflows/pages.yml  # GitHub Pages deployment
```

## License

[MIT](LICENSE)
