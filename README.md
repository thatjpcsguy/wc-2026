# World Cup 2026 — Favourites Simulator

An interactive, single-file simulator of the rest of the 2026 FIFA World Cup.

- Built from the **real played scorelines** (updated through the group stage).
- Projects every remaining group game and knockout tie to the **favourite**, with a grounded **Poisson expected-goals** model for scorelines.
- Full 2026 **knockout bracket** (Round of 32 → Final), including the 8 best third-placed teams slotted via FIFA's eligibility matrix.
- **2026 FIFA tiebreakers** (head-to-head first), with H2H-decided places tagged.
- Toggle the favourite source between **subjective ratings** and the **betting market** (outright title odds).
- **Monte Carlo** mode: thousands of randomised tournaments → each team's title / round probabilities, with a model-vs-market edge column.
- Click any team in a fixture for +1 goal, or any knockout match to flip the winner — the whole bracket recomputes.

Open `index.html` in any browser. No build step, no dependencies.
