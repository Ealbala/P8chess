// Key theoretical endgames. Every result (win/draw) was checked with the Lichess tablebase.
import type { L10n } from './openings'

export interface EndgameLesson {
  id: string
  fen: string
  goal: 'win' | 'draw'
  name: L10n
  idea: L10n
}

export const ENDGAMES: EndgameLesson[] = [
  {
    id: 'kqk',
    fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    goal: 'win',
    name: { en: 'Queen mate', es: 'Mate con dama' },
    idea: {
      en: 'Use the queen to shrink the king\'s box (a knight\'s move away), then bring your king. Watch out for stalemate!',
      es: 'Con la dama achicá la caja del rey (a salto de caballo), después acercá tu rey. ¡Cuidado con el ahogado!',
    },
  },
  {
    id: 'krk',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'win',
    name: { en: 'Rook mate', es: 'Mate con torre' },
    idea: {
      en: 'Cut the king off with the rook, bring your king in opposition, then check. Push the king to the edge rank by rank.',
      es: 'Cortá al rey con la torre, poné tu rey en oposición y dá jaque. Empujá al rey hacia el borde fila por fila.',
    },
  },
  {
    id: 'kpk-win',
    fen: '3k4/8/3K4/3P4/8/8/8/8 w - - 0 1',
    goal: 'win',
    name: { en: 'King and pawn: king in front', es: 'Rey y peón: rey adelante' },
    idea: {
      en: 'With your king on the 6th rank in front of the pawn it always wins: use the opposition and escort the pawn.',
      es: 'Con tu rey en sexta fila delante del peón siempre se gana: usá la oposición y escoltá al peón.',
    },
  },
  {
    id: 'kpk-draw',
    fen: '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1',
    goal: 'draw',
    name: { en: 'King and pawn: defending', es: 'Rey y peón: defensa' },
    idea: {
      en: 'You defend with Black. Stay in front of the pawn and take the opposition when the white king steps up.',
      es: 'Defendés con negras. Quedate delante del peón y tomá la oposición cuando el rey blanco avance.',
    },
  },
  {
    id: 'lucena',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    goal: 'win',
    name: { en: 'Lucena position (building a bridge)', es: 'Posición de Lucena (construir el puente)' },
    idea: {
      en: 'Rd1+ to push the black king away, then Rd4: the rook will block the checks ("bridge") so your king can come out.',
      es: 'Td1+ para alejar al rey negro y después Td4: la torre va a tapar los jaques ("puente") para que salga tu rey.',
    },
  },
  {
    id: 'philidor',
    fen: '4k3/R7/7r/3KP3/8/8/8/8 b - - 0 1',
    goal: 'draw',
    name: { en: 'Philidor position (defending)', es: 'Posición de Philidor (defensa)' },
    idea: {
      en: 'You defend with Black: keep your rook on the 6th rank. When the pawn advances to e6, go to the back and give checks from behind.',
      es: 'Defendés con negras: mantené la torre en sexta. Cuando el peón llegue a e6, andá atrás y dá jaques desde lejos.',
    },
  },
]
