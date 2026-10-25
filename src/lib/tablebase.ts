// Lichess tablebase API (https://tablebase.lichess.ovh): perfect play for ≤ 7 pieces.
// Used as the opponent and the judge in theoretical endgames. Needs an internet connection.

export type Category =
  | 'win' | 'unknown' | 'syzygy-win' | 'maybe-win' | 'cursed-win' | 'draw'
  | 'blessed-loss' | 'maybe-loss' | 'syzygy-loss' | 'loss'

export interface TablebaseResult {
  category: Category
  dtm: number | null
  checkmate: boolean
  stalemate: boolean
  insufficient_material: boolean
  moves: { uci: string; san: string; category: Category }[]
}

export async function probe(fen: string): Promise<TablebaseResult> {
  const res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
  if (!res.ok) throw new Error(`tablebase ${res.status}`)
  return res.json()
}

export const isWin = (c: Category) => c === 'win' || c === 'syzygy-win' || c === 'maybe-win'
export const isLoss = (c: Category) => c === 'loss' || c === 'syzygy-loss' || c === 'maybe-loss'
