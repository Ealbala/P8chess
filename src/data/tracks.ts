// Training sections ("tracks"): groups of Lichess puzzle themes you can train and be rated on.
import type { L10n } from './openings'
import type { Puzzle } from '../lib/puzzles'

export interface Track {
  id: string
  icon: string
  name: L10n
  group: 'phase' | 'tactic' | 'endgame'
  /** Lichess themes; a puzzle belongs to the track if it has any of them (or the category). */
  themes?: string[]
  cats?: Puzzle['cat'][]
  /** Related lessons in the app, shown on the track. */
  related?: { to: string; label: L10n }[]
}

export const TRACKS: Track[] = [
  {
    id: 'openings', icon: '📖', group: 'phase', cats: ['opening'], themes: ['opening'],
    name: { en: 'Opening', es: 'Apertura' },
    related: [{ to: '/train/openings', label: { en: 'Your repertoire', es: 'Tu repertorio' } }],
  },
  {
    id: 'middlegame', icon: '🏰', group: 'phase', cats: ['middlegame'], themes: ['middlegame'],
    name: { en: 'Middlegame', es: 'Medio juego' },
    related: [{ to: '/train/strategy', label: { en: 'Middlegame plans', es: 'Planes de medio juego' } }],
  },
  {
    id: 'endgame', icon: '🏁', group: 'phase', cats: ['endgame'], themes: ['endgame'],
    name: { en: 'Endgame', es: 'Finales' },
    related: [{ to: '/train/endgames', label: { en: 'Endgame theory', es: 'Finales teóricos' } }],
  },
  { id: 'calculation', icon: '🧠', group: 'phase', cats: ['calculation'], themes: ['long', 'veryLong'], name: { en: 'Calculation', es: 'Cálculo' } },
  { id: 'forks', icon: '🍴', group: 'tactic', themes: ['fork'], name: { en: 'Forks (double attacks)', es: 'Ataques dobles' } },
  { id: 'pins', icon: '📌', group: 'tactic', themes: ['pin', 'skewer', 'xRayAttack'], name: { en: 'Pins and skewers', es: 'Clavadas y enfiladas' } },
  { id: 'discovered', icon: '💥', group: 'tactic', themes: ['discoveredAttack', 'doubleCheck'], name: { en: 'Discovered attacks', es: 'Ataques a la descubierta' } },
  { id: 'mates', icon: '♚', group: 'tactic', themes: ['mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate'], name: { en: 'Checkmate patterns', es: 'Patrones de mate' } },
  {
    id: 'sacrifices', icon: '🎯', group: 'tactic',
    themes: ['sacrifice', 'attraction', 'deflection', 'clearance', 'interference', 'capturingDefender'],
    name: { en: 'Sacrifices and deflections', es: 'Sacrificios y desviaciones' },
  },
  { id: 'attack', icon: '⚔️', group: 'tactic', themes: ['kingsideAttack', 'exposedKing', 'attackingF2F7'], name: { en: 'Attacking the king', es: 'Ataque al rey' } },
  { id: 'defense', icon: '🛡️', group: 'tactic', themes: ['defensiveMove', 'quietMove', 'intermezzo'], name: { en: 'Defence and quiet moves', es: 'Defensa y jugadas tranquilas' } },
  { id: 'hanging', icon: '🪤', group: 'tactic', themes: ['hangingPiece', 'trappedPiece'], name: { en: 'Hanging and trapped pieces', es: 'Piezas colgadas y atrapadas' } },
  { id: 'pawns', icon: '♙', group: 'endgame', themes: ['advancedPawn', 'promotion', 'underPromotion', 'pawnEndgame'], name: { en: 'Pawns and promotion', es: 'Peones y coronación' } },
  { id: 'rook-endgames', icon: '♜', group: 'endgame', themes: ['rookEndgame'], name: { en: 'Rook endgames', es: 'Finales de torres' } },
  { id: 'minor-endgames', icon: '♝', group: 'endgame', themes: ['bishopEndgame', 'knightEndgame'], name: { en: 'Bishop and knight endgames', es: 'Finales de alfiles y caballos' } },
  { id: 'queen-endgames', icon: '♛', group: 'endgame', themes: ['queenEndgame', 'queenRookEndgame', 'zugzwang'], name: { en: 'Queen endgames and zugzwang', es: 'Finales de dama y zugzwang' } },
]

export function inTrack(track: Track, p: { cat: string; themes: string[] }) {
  return (track.cats?.includes(p.cat as Puzzle['cat']) ?? false) || (track.themes?.some((t) => p.themes.includes(t)) ?? false)
}

export const findTrack = (id: string) => TRACKS.find((t) => t.id === id)
