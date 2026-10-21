/**
 * The equivalent Python program (integrated GUI with tkinter, standard
 * library only). It is displayed, copied and downloaded from the
 * "Python" tab.
 */
export const PYTHON_SOURCE = String.raw`"""
THE KNIGHT'S TOUR — solver with an integrated GUI (tkinter)

Rules: the knight moves in an "L" (2 squares in one direction and 1
in the perpendicular one). Goal: visit every square of the board
exactly once.

Strategy: Warnsdorff's rule (1823) — always move the knight to the
square with the fewest onward exits — combined with budget-limited
backtracking, which guarantees a solution whenever one exists.

Usage:  python knights_tour.py   (requires only the standard library)
"""
import tkinter as tk

MOVES = [(1, 2), (2, 1), (2, -1), (1, -2),
         (-1, -2), (-2, -1), (-2, 1), (-1, 2)]

NODE_LIMIT = 500_000   # maximum search budget, in nodes


class KnightsTour:
    def __init__(self, root):
        self.root = root
        root.title("The Knight's Tour")
        root.resizable(False, False)
        root.configure(bg="#22301f")

        self.n = 8                # board size
        self.cell = 70            # side of a square, in pixels
        self.delay = 120          # ms between consecutive moves
        self.paused = False
        self.started = False

        # ---------- control bar ----------
        toolbar = tk.Frame(root, bg="#22301f")
        toolbar.pack(pady=6)
        tk.Label(toolbar, text="Size:", bg="#22301f",
                 fg="#e8e2ce").pack(side="left")
        self.spin = tk.Spinbox(toolbar, from_=5, to=10, width=3,
                               command=self.new_game)
        self.spin.delete(0, "end")
        self.spin.insert(0, "8")
        self.spin.pack(side="left", padx=(2, 10))
        tk.Button(toolbar, text="New game",
                  command=self.new_game).pack(side="left", padx=2)
        self.pause_btn = tk.Button(toolbar, text="Pause", state="disabled",
                                   command=self.toggle_pause)
        self.pause_btn.pack(side="left", padx=2)
        tk.Label(toolbar, text="Speed:", bg="#22301f",
                 fg="#e8e2ce").pack(side="left", padx=(14, 2))
        self.slider = tk.Scale(toolbar, from_=10, to=400, length=130,
                               orient="horizontal", showvalue=False,
                               command=self.change_speed)
        self.slider.pack(side="left")
        self.slider.set(290)

        self.label = tk.Label(
            root, bg="#22301f", fg="#f0cd7e",
            text="Click a square: it will be the knight's starting point",
            font=("Helvetica", 11, "bold"))
        self.label.pack(pady=4)

        self.canvas = tk.Canvas(root, bg="#182218", highlightthickness=0)
        self.canvas.pack(padx=10, pady=(0, 10))
        self.canvas.bind("<Button-1>", self.on_click)

        self.new_game()

    # ------------------------------------------------------------------ #
    #  Drawing the board                                                 #
    # ------------------------------------------------------------------ #
    def new_game(self):
        try:
            self.n = int(self.spin.get())
        except ValueError:
            self.n = 8
        self.n = max(5, min(10, self.n))
        self.cell = max(44, 560 // self.n)
        self.grid = [[-1] * self.n for _ in range(self.n)]
        self.path = []
        self.started = False
        self.paused = False
        self.pause_btn.config(state="disabled", text="Pause")
        self.label.config(
            text="Click a square: it will be the knight's starting point")
        self.draw_board()

    def draw_board(self):
        n, c = self.n, self.cell
        self.canvas.config(width=n * c, height=n * c)
        self.canvas.delete("all")
        for y in range(n):
            for x in range(n):
                color = "#e8d5a7" if (x + y) % 2 == 0 else "#8a613c"
                self.canvas.create_rectangle(
                    x * c, y * c, (x + 1) * c, (y + 1) * c,
                    fill=color, outline="")
        # invisible anchor: the path trail will sit below the move numbers
        self.canvas.create_rectangle(-5, -5, -4, -4, tags="below")
        for y in range(n):
            for x in range(n):
                self.canvas.create_text(
                    x * c + c // 2, y * c + c // 2, text="",
                    tags="num%d,%d" % (x, y), fill="#332412",
                    font=("Helvetica", max(10, int(c * 0.30)), "bold"))
        self.knight_id = self.canvas.create_text(
            -50, -50, text="\u265E", fill="#181410",
            font=("Helvetica", int(c * 0.66)))

    def place_knight(self, x, y):
        c = self.cell
        self.canvas.coords(self.knight_id, x * c + c // 2, y * c + c // 2)
        self.canvas.tag_raise(self.knight_id)

    # ------------------------------------------------------------------ #
    #  Logic: legal moves, Warnsdorff, backtracking                      #
    # ------------------------------------------------------------------ #
    def degree(self, x, y):
        """Number of legal moves still available from square (x, y)."""
        free = 0
        for dx, dy in MOVES:
            nx, ny = x + dx, y + dy
            if (0 <= nx < self.n and 0 <= ny < self.n
                    and self.grid[ny][nx] == -1):
                free += 1
        return free

    def options(self, x, y):
        """Legal moves from (x, y), ordered by Warnsdorff's rule."""
        result = []
        for dx, dy in MOVES:
            nx, ny = x + dx, y + dy
            if (0 <= nx < self.n and 0 <= ny < self.n
                    and self.grid[ny][nx] == -1):
                result.append((self.degree(nx, ny), nx, ny))
        result.sort(reverse=True)  # the stack consumes the lowest degree first
        return result

    def on_click(self, event):
        if self.started:
            return
        x, y = event.x // self.cell, event.y // self.cell
        if not (0 <= x < self.n and 0 <= y < self.n):
            return
        self.started = True
        self.grid[y][x] = 0
        self.path = [(x, y)]
        self.stack = [self.options(x, y)]
        self.nodes = 0
        self.pause_btn.config(state="normal")
        self.label.config(text="Searching for a path…")
        self.root.after(30, self.search_step)

    def search_step(self):
        """Iterative backtracking in chunks: the GUI always stays responsive."""
        total = self.n * self.n
        for _ in range(4000):
            if len(self.path) == total:
                return self.solved()
            if self.stack[-1]:
                _, x, y = self.stack[-1].pop()
                self.grid[y][x] = len(self.path)
                self.path.append((x, y))
                self.stack.append(self.options(x, y))
            else:
                self.stack.pop()
                if not self.stack:
                    return self.failed()
                x, y = self.path.pop()
                self.grid[y][x] = -1
            self.nodes += 1
            if self.nodes > NODE_LIMIT:
                return self.failed()
        self.label.config(
            text="Searching… %d nodes, %d/%d squares"
                 % (self.nodes, len(self.path), total))
        self.root.after(10, self.search_step)

    def solved(self):
        self.label.config(
            text="Complete! %d squares — %d nodes explored"
                 % (len(self.path), self.nodes))
        self.pause_btn.config(state="disabled")
        self.i = 0
        self.root.after(50, self.animation_step)

    def failed(self):
        self.label.config(
            text="No tour found (%d nodes). On odd boards, start from "
                 "a square of the corner color." % self.nodes)
        self.pause_btn.config(state="disabled")

    # ------------------------------------------------------------------ #
    #  Animating the path                                                #
    # ------------------------------------------------------------------ #
    def animation_step(self):
        if self.paused:
            self.root.after(80, self.animation_step)
            return
        if self.i >= len(self.path):
            return
        x, y = self.path[self.i]
        c = self.cell
        if self.i > 0:
            px, py = self.path[self.i - 1]
            self.canvas.create_line(
                px * c + c // 2, py * c + c // 2,
                x * c + c // 2, y * c + c // 2,
                fill="#c9973b", width=3, tags="trail")
            self.canvas.tag_lower("trail", "below")
        self.place_knight(x, y)
        self.canvas.itemconfig("num%d,%d" % (x, y), text=str(self.i + 1))
        self.canvas.tag_raise("num%d,%d" % (x, y))
        self.i += 1
        self.root.after(self.delay, self.animation_step)

    def change_speed(self, value):
        # the slider goes from slow (400 ms) to fast (10 ms)
        self.delay = 410 - int(float(value))

    def toggle_pause(self):
        self.paused = not self.paused
        self.pause_btn.config(text="Resume" if self.paused else "Pause")


if __name__ == "__main__":
    root = tk.Tk()
    app = KnightsTour(root)
    root.mainloop()
`;
