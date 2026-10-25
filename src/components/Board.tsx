// Interactive board: drag-and-drop on desktop, tap-to-move on phones.
// The parent owns the position (FEN) and decides whether a move is accepted.
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'

interface Props {
  fen: string
  orientation?: 'white' | 'black'
  /** Return true if the move was accepted. */
  onMove?: (from: Square, to: Square, promotion?: string) => boolean
  interactive?: boolean
  lastMove?: [string, string] | null
  marks?: Record<string, CSSProperties>
  showCoordinates?: boolean
  hidePieces?: boolean
  onSquareTap?: (square: Square) => void
}

const LAST_MOVE: CSSProperties = { background: 'rgba(250, 204, 21, 0.45)' }
const SELECTED: CSSProperties = { background: 'rgba(34, 197, 94, 0.55)' }
const DOT: CSSProperties = { background: 'radial-gradient(circle, rgba(0,0,0,.28) 22%, transparent 24%)' }
const CAPTURE: CSSProperties = { background: 'radial-gradient(circle, transparent 58%, rgba(0,0,0,.28) 60%)' }

export default function Board({
  fen,
  orientation = 'white',
  onMove,
  interactive = true,
  lastMove,
  marks,
  showCoordinates = true,
  hidePieces = false,
  onSquareTap,
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null)
  const chess = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [fen])

  const targets = useMemo(() => {
    if (!chess || !selected) return []
    return chess.moves({ square: selected, verbose: true })
  }, [chess, selected])

  function tryMove(from: Square, to: Square): boolean {
    if (!chess || !onMove) return false
    const move = chess.moves({ square: from, verbose: true }).find((m) => m.to === to)
    if (!move) return false
    setSelected(null)
    // Auto-promote to queen; the puzzle trainer overrides this when the solution needs another piece.
    return onMove(from, to, move.promotion ? 'q' : undefined)
  }

  function handleSquareClick(square: Square) {
    onSquareTap?.(square)
    if (!interactive || !chess) return
    if (selected && targets.some((m) => m.to === square)) {
      tryMove(selected, square)
      return
    }
    const piece = chess.get(square)
    setSelected(piece && piece.color === chess.turn() ? square : null)
  }

  const styles: Record<string, CSSProperties> = {}
  if (lastMove) {
    styles[lastMove[0]] = LAST_MOVE
    styles[lastMove[1]] = LAST_MOVE
  }
  if (selected) styles[selected] = SELECTED
  for (const m of targets) styles[m.to] = { ...styles[m.to], ...(m.captured ? CAPTURE : DOT) }
  Object.assign(styles, marks)

  return (
    <div className="w-full overflow-hidden rounded-xl shadow-md select-none touch-none">
      <Chessboard
        id="board"
        position={hidePieces ? '8/8/8/8/8/8/8/8 w - - 0 1' : fen}
        boardOrientation={orientation}
        arePiecesDraggable={interactive}
        onPieceDrop={(from, to) => tryMove(from as Square, to as Square)}
        onPieceDragBegin={(_, sq) => setSelected(sq as Square)}
        onSquareClick={(sq) => handleSquareClick(sq as Square)}
        customSquareStyles={styles}
        showBoardNotation={showCoordinates}
        autoPromoteToQueen
        animationDuration={200}
        customDarkSquareStyle={{ backgroundColor: '#769656' }}
        customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
      />
    </div>
  )
}
