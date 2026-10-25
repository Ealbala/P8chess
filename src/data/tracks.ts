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

/** Short lesson for each section: what it is and what to look for. */
export const TRACK_LESSONS: Record<string, { what: L10n; look: L10n[]; youtube: L10n }> = {
  openings: {
    what: { en: 'Tactics that appear early, while pieces are still developing and kings may not be castled.', es: 'Tácticas que aparecen temprano, con las piezas desarrollándose y los reyes muchas veces sin enrocar.' },
    look: [
      { en: 'Undefended pieces after the first exchanges.', es: 'Piezas sin defensa después de los primeros cambios.' },
      { en: 'The weak f7/f2 square and the uncastled king on the e-file.', es: 'La casilla débil f7/f2 y el rey sin enrocar en la columna e.' },
      { en: 'Pins on knights (Bb5, Bg5) and queens out too early.', es: 'Clavadas sobre caballos (Ab5, Ag5) y damas que salen demasiado pronto.' },
    ],
    youtube: { en: 'chess opening traps tactics', es: 'trampas de apertura ajedrez' },
  },
  middlegame: {
    what: { en: 'Combinations in the middlegame: many pieces on the board, kings castled, lots of contact.', es: 'Combinaciones en el medio juego: muchas piezas, reyes enrocados y mucho contacto.' },
    look: [
      { en: 'Checks, captures and threats — for both sides — before every move.', es: 'Jaques, capturas y amenazas, de los dos bandos, antes de cada jugada.' },
      { en: 'Overloaded defenders: a piece that defends two things at once.', es: 'Defensores sobrecargados: una pieza que defiende dos cosas a la vez.' },
      { en: 'Weak back rank and an exposed king.', es: 'Primera fila débil y rey expuesto.' },
    ],
    youtube: { en: 'chess middlegame tactics explained', es: 'táctica medio juego ajedrez explicación' },
  },
  endgame: {
    what: { en: 'Tactics with few pieces: the king is active, pawns become queens and every tempo counts.', es: 'Táctica con pocas piezas: el rey es activo, los peones se convierten en damas y cada tiempo cuenta.' },
    look: [
      { en: 'Passed pawns and promotion squares.', es: 'Peones pasados y casillas de coronación.' },
      { en: 'Opposition and king activity.', es: 'Oposición y actividad del rey.' },
      { en: 'Simplifying into a won pawn endgame.', es: 'Simplificar a un final de peones ganado.' },
    ],
    youtube: { en: 'chess endgame technique', es: 'finales de ajedrez técnica' },
  },
  calculation: {
    what: { en: 'Long combinations (3+ of your moves). You must see the whole line before moving.', es: 'Combinaciones largas (3 o más jugadas tuyas). Tenés que ver toda la línea antes de mover.' },
    look: [
      { en: 'List the forcing moves first: checks, captures, threats.', es: 'Primero listá las jugadas forzadas: jaques, capturas, amenazas.' },
      { en: 'For each one, find the opponent\'s best reply, not the one you hope for.', es: 'Para cada una, buscá la mejor respuesta del rival, no la que esperás.' },
      { en: 'Count the material at the end of the line.', es: 'Contá el material al final de la línea.' },
    ],
    youtube: { en: 'how to calculate chess variations', es: 'cómo calcular variantes ajedrez' },
  },
  forks: {
    what: { en: 'A fork (double attack) is one move that attacks two targets at once; the opponent can only save one.', es: 'Un ataque doble es una jugada que ataca dos objetivos a la vez; el rival solo puede salvar uno.' },
    look: [
      { en: 'Knights: look for squares that hit the king and a big piece.', es: 'Caballos: buscá casillas que ataquen al rey y a una pieza grande.' },
      { en: 'Unprotected pieces and pieces on the same colour or line.', es: 'Piezas sin defensa y piezas en el mismo color o línea.' },
      { en: 'Checks that also attack something else.', es: 'Jaques que además atacan otra cosa.' },
    ],
    youtube: { en: 'chess fork tactic explained', es: 'ataque doble ajedrez explicación' },
  },
  pins: {
    what: { en: 'A pin freezes a piece because a more valuable one (or the king) is behind it. A skewer is the reverse: the big piece is in front.', es: 'Una clavada inmoviliza una pieza porque detrás hay otra más valiosa (o el rey). La enfilada es al revés: la pieza grande está adelante.' },
    look: [
      { en: 'King and queen on the same line or diagonal.', es: 'Rey y dama en la misma línea o diagonal.' },
      { en: 'Attack the pinned piece again: it cannot run away.', es: 'Atacá de nuevo a la pieza clavada: no puede escapar.' },
      { en: 'Bishops, rooks and queens are the pieces that pin.', es: 'Alfiles, torres y damas son las piezas que clavan.' },
    ],
    youtube: { en: 'chess pin and skewer explained', es: 'clavada y enfilada ajedrez' },
  },
  discovered: {
    what: { en: 'Moving one piece uncovers an attack by another piece behind it. With check, it is often decisive.', es: 'Al mover una pieza se destapa el ataque de otra que estaba detrás. Si es con jaque, suele ser decisivo.' },
    look: [
      { en: 'Your piece standing between your bishop/rook/queen and an enemy target.', es: 'Una pieza tuya entre tu alfil/torre/dama y un objetivo rival.' },
      { en: 'The moving piece should create a second threat.', es: 'La pieza que se mueve tiene que crear una segunda amenaza.' },
      { en: 'Double check: the king must move.', es: 'Jaque doble: el rey está obligado a moverse.' },
    ],
    youtube: { en: 'chess discovered attack explained', es: 'ataque a la descubierta ajedrez' },
  },
  mates: {
    what: { en: 'Recognising mating patterns (back rank, smothered mate, mate in 2–3) so you see them in your games.', es: 'Reconocer patrones de mate (pasillo, mate ahogado, mate en 2–3) para verlos en tus partidas.' },
    look: [
      { en: 'A king without escape squares (pawns in front, own pieces around).', es: 'Un rey sin casillas de escape (peones adelante, piezas propias alrededor).' },
      { en: 'Checks first, even sacrifices.', es: 'Primero los jaques, aunque sean sacrificios.' },
      { en: 'Which squares around the king does nothing defend?', es: '¿Qué casillas alrededor del rey no defiende nadie?' },
    ],
    youtube: { en: 'checkmate patterns chess', es: 'patrones de mate ajedrez' },
  },
  sacrifices: {
    what: { en: 'Giving material to drag a piece to a bad square (attraction), lure a defender away (deflection) or open a line.', es: 'Entregar material para llevar una pieza a una mala casilla (atracción), alejar a un defensor (desviación) o abrir una línea.' },
    look: [
      { en: 'Which enemy piece is the key defender?', es: '¿Cuál es el defensor clave del rival?' },
      { en: 'What do you get after the sacrifice is accepted? Calculate to the end.', es: '¿Qué ganás si aceptan el sacrificio? Calculá hasta el final.' },
      { en: 'Forcing moves after the sacrifice.', es: 'Jugadas forzadas después del sacrificio.' },
    ],
    youtube: { en: 'chess deflection attraction sacrifice', es: 'sacrificio desviación atracción ajedrez' },
  },
  attack: {
    what: { en: 'Attacks against the king: open lines, missing defenders and pieces aimed at the castle.', es: 'Ataques al rey: líneas abiertas, defensores que faltan y piezas apuntando al enroque.' },
    look: [
      { en: 'Count attackers vs defenders around the king.', es: 'Contá atacantes contra defensores alrededor del rey.' },
      { en: 'Weak squares like h7, g7, f7 (or h2, g2, f2).', es: 'Casillas débiles como h7, g7, f7 (o h2, g2, f2).' },
      { en: 'Bring one more piece before striking.', es: 'Traé una pieza más antes de golpear.' },
    ],
    youtube: { en: 'how to attack the king chess', es: 'ataque al rey ajedrez' },
  },
  defense: {
    what: { en: 'Finding the only defensive move, or a quiet move that prepares the decisive blow.', es: 'Encontrar la única defensa, o una jugada tranquila que prepara el golpe decisivo.' },
    look: [
      { en: 'What is the opponent threatening right now?', es: '¿Qué está amenazando el rival ahora mismo?' },
      { en: 'In-between moves (zwischenzug) before recapturing.', es: 'Jugadas intermedias antes de recapturar.' },
      { en: 'Not every strong move is a check or a capture.', es: 'No toda jugada fuerte es un jaque o una captura.' },
    ],
    youtube: { en: 'chess defensive technique quiet move', es: 'defensa en ajedrez jugada intermedia' },
  },
  hanging: {
    what: { en: 'Pieces left unprotected, or with no safe square to go to.', es: 'Piezas que quedan sin defensa, o sin casillas seguras a donde ir.' },
    look: [
      { en: 'After every move: what is undefended on both sides?', es: 'Después de cada jugada: ¿qué quedó sin defensa en los dos bandos?' },
      { en: 'Pieces on the edge have few squares — can you trap them?', es: 'Las piezas en el borde tienen pocas casillas: ¿las podés atrapar?' },
      { en: 'Count attackers and defenders before capturing.', es: 'Contá atacantes y defensores antes de capturar.' },
    ],
    youtube: { en: 'chess hanging pieces trapped pieces', es: 'piezas colgadas atrapadas ajedrez' },
  },
  pawns: {
    what: { en: 'Advanced and passed pawns, promotion, and pawn endgames.', es: 'Peones avanzados y pasados, coronación y finales de peones.' },
    look: [
      { en: 'Can the king catch the pawn? (rule of the square)', es: '¿El rey llega a atrapar el peón? (regla del cuadrado)' },
      { en: 'Clear the promotion square: deflect or block the defender.', es: 'Despejá la casilla de coronación: desviá o bloqueá al defensor.' },
      { en: 'Opposition and tempo moves in pawn endgames.', es: 'Oposición y jugadas de espera en finales de peones.' },
    ],
    youtube: { en: 'pawn endgame opposition rule of the square', es: 'finales de peones oposición regla del cuadrado' },
  },
  'rook-endgames': {
    what: { en: 'The most common endgames: rook activity, cutting off the king, Lucena and Philidor ideas.', es: 'Los finales más comunes: actividad de la torre, cortar al rey, ideas de Lucena y Philidor.' },
    look: [
      { en: 'Rooks belong behind passed pawns.', es: 'Las torres van detrás de los peones pasados.' },
      { en: 'Cut the enemy king off along a file or rank.', es: 'Cortá al rey rival por una columna o una fila.' },
      { en: 'Checks from far away.', es: 'Jaques desde lejos.' },
    ],
    youtube: { en: 'rook endgame lucena philidor', es: 'finales de torres lucena philidor' },
  },
  'minor-endgames': {
    what: { en: 'Bishop and knight endgames: good vs bad bishop, knight forks and blockades.', es: 'Finales de alfil y caballo: alfil bueno contra malo, dobles del caballo y bloqueos.' },
    look: [
      { en: 'Pawns on the colour of your bishop make it bad.', es: 'Los peones en el color de tu alfil lo vuelven malo.' },
      { en: 'Knights are slow: count the moves they need.', es: 'Los caballos son lentos: contá cuántas jugadas necesitan.' },
      { en: 'Distant passed pawns win.', es: 'Los peones pasados lejanos ganan.' },
    ],
    youtube: { en: 'bishop vs knight endgame', es: 'finales alfil contra caballo' },
  },
  'queen-endgames': {
    what: { en: 'Queen endgames (perpetual check is everywhere) and zugzwang: any move worsens the position.', es: 'Finales de dama (el jaque perpetuo aparece siempre) y zugzwang: cualquier jugada empeora la posición.' },
    look: [
      { en: 'Shelter your king from perpetual checks.', es: 'Protegé a tu rey de los jaques perpetuos.' },
      { en: 'Zugzwang: make a waiting move and let the opponent run out of moves.', es: 'Zugzwang: hacé una jugada de espera y dejá que al rival se le acaben las jugadas.' },
      { en: 'Centralise the queen.', es: 'Centralizá la dama.' },
    ],
    youtube: { en: 'zugzwang chess explained', es: 'zugzwang ajedrez explicación' },
  },
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
