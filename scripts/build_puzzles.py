"""
Builds public/data/puzzles.json from the Lichess puzzle database (CC0 license).

Usage:
  1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst
  2. Decompress it to lichess_db_puzzle.csv (e.g. with `zstd -d`)
  3. python3 scripts/build_puzzles.py path/to/lichess_db_puzzle.csv

We keep a small, well-tested subset (popular puzzles with stable ratings) so the app
works offline and loads quickly on a phone. Each puzzle gets exactly one category:
endgame > opening (tagged with one of our openings) > calculation (long) > middlegame
(attack/defence/quiet-move themes) > tactics.
"""
import csv
import json
import random
import sys
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "lichess_db_puzzle.csv"
OUT = "public/data/puzzles.json"

# Lichess opening tags → opening ids used in src/data/openings.ts
OPENING_TAGS = {
    "French_Defense": "french",
    "Queens_Pawn_Game_Colle_System": "colle",
    "Queens_Pawn_Game_Zukertort_Variation": "colle",
    "Queens_Pawn_Game": "colle",
    "Queens_Gambit_Declined": "qgd",
    "London_System": "london",
    "Queens_Pawn_Game_London_System": "london",
    "Indian_Defense_London_System": "london",
    "Italian_Game": "italian",
    "Caro-Kann_Defense": "caro",
    "Englund_Gambit": "colle",
}
MIDDLEGAME = {
    "kingsideAttack", "queensideAttack", "exposedKing", "defensiveMove", "quietMove", "intermezzo",
    "clearance", "attackingF2F7", "advancedPawn", "trappedPiece", "capturingDefender", "interference",
}

random.seed(42)
buckets = defaultdict(list)  # (category or opening id, rating band) -> puzzles

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
        openings = sorted({OPENING_TAGS[t] for t in row["OpeningTags"].split() if t in OPENING_TAGS})
        if "endgame" in themes:
            cat = "endgame"
        elif openings and "opening" in themes:
            cat = "opening"
        elif "long" in themes or "veryLong" in themes:
            cat = "calculation"
        elif "middlegame" in themes and MIDDLEGAME.intersection(themes):
            cat = "middlegame"
        else:
            cat = "tactics"
        puzzle = {
            "id": row["PuzzleId"],
            "fen": row["FEN"],
            "moves": row["Moves"].split(),
            "rating": rating,
            "themes": themes,
            "cat": cat,
        }
        if cat == "opening":
            puzzle["openings"] = openings
            # "colle" also catches generic Queen's Pawn tags, so prefer a more specific opening.
            key = next((o for o in openings if o != "colle"), "colle")
        else:
            key = cat
        buckets[(key, rating // 100)].append(puzzle)

PER_BAND = {"tactics": 45, "calculation": 25, "middlegame": 30, "endgame": 35}
PER_BAND_OPENING = 12
result = []
chosen = set()
for (key, band), items in sorted(buckets.items()):
    random.shuffle(items)
    for p in items[: PER_BAND.get(key, PER_BAND_OPENING)]:
        result.append(p)
        chosen.add(p["id"])

# Theme sections (training tracks): make sure every key theme has puzzles at every level.
KEY_THEMES = [
    "fork", "pin", "skewer", "xRayAttack", "discoveredAttack", "doubleCheck", "mateIn1", "mateIn2",
    "mateIn3", "backRankMate", "sacrifice", "attraction", "deflection", "clearance", "interference",
    "capturingDefender", "defensiveMove", "quietMove", "intermezzo", "hangingPiece", "trappedPiece",
    "kingsideAttack", "exposedKing", "attackingF2F7", "advancedPawn", "promotion", "pawnEndgame",
    "rookEndgame", "bishopEndgame", "knightEndgame", "queenEndgame", "zugzwang",
]
PER_THEME_BAND = 8
by_theme = defaultdict(list)
for items in buckets.values():
    for p in items:
        for t in p["themes"]:
            if t in KEY_THEMES:
                by_theme[(t, p["rating"] // 100)].append(p)
for (theme, band), items in sorted(by_theme.items()):
    have = sum(1 for p in result if theme in p["themes"] and p["rating"] // 100 == band)
    random.shuffle(items)
    for p in items:
        if have >= PER_THEME_BAND:
            break
        if p["id"] not in chosen:
            result.append(p)
            chosen.add(p["id"])
            have += 1

with open(OUT, "w") as f:
    json.dump(result, f, separators=(",", ":"))

counts = defaultdict(int)
theme_counts = defaultdict(int)
for p in result:
    for t in p["themes"]:
        theme_counts[t] += 1
    for o in p.get("openings", [p["cat"]]):
        counts[o] += 1
print(f"Wrote {len(result)} puzzles to {OUT}: {dict(sorted(counts.items()))}")
print("Key themes:", {t: theme_counts[t] for t in KEY_THEMES})
