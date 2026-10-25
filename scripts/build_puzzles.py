"""
Builds public/data/puzzles.json from the Lichess puzzle database (CC0 license).

Usage:
  1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst
  2. Decompress it to lichess_db_puzzle.csv (e.g. with `zstd -d`)
  3. python3 scripts/build_puzzles.py path/to/lichess_db_puzzle.csv

We keep a small, well-tested subset (popular puzzles with stable ratings)
so the app works offline and loads quickly on a phone.
"""
import csv
import json
import random
import sys
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "lichess_db_puzzle.csv"
OUT = "public/data/puzzles.json"

random.seed(42)
buckets = defaultdict(list)  # (category, rating band) -> puzzles

with open(SRC, newline="") as f:
    for row in csv.DictReader(f):
        try:
            rating = int(row["Rating"])
            rd = int(row["RatingDeviation"])
            pop = int(row["Popularity"])
            plays = int(row["NbPlays"])
        except (ValueError, KeyError, TypeError):
            continue
        if not (900 <= rating <= 2300) or rd > 90 or pop < 85 or plays < 800:
            continue
        themes = row["Themes"].split()
        if "endgame" in themes:
            cat = "endgame"
        elif "long" in themes or "veryLong" in themes:
            cat = "calculation"
        else:
            cat = "tactics"
        band = rating // 100
        buckets[(cat, band)].append(
            {
                "id": row["PuzzleId"],
                "fen": row["FEN"],
                "moves": row["Moves"].split(),
                "rating": rating,
                "themes": themes,
                "cat": cat,
            }
        )

PER_BAND = {"tactics": 45, "calculation": 25, "endgame": 25}
result = []
for (cat, band), items in sorted(buckets.items()):
    random.shuffle(items)
    result.extend(items[: PER_BAND[cat]])

with open(OUT, "w") as f:
    json.dump(result, f, separators=(",", ":"))

counts = defaultdict(int)
for p in result:
    counts[p["cat"]] += 1
print(f"Wrote {len(result)} puzzles to {OUT}: {dict(counts)}")
