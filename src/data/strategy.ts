// Middlegame strategy lessons built on the structures from your own openings.
// Positions come from legal move sequences (checked by a test). "move" steps were checked
// with Stockfish 17.1 (depth 20): the accepted move is the best or within 0.05 of it.
import type { L10n } from './openings'

export interface ChoiceStep {
  type: 'choice'
  question: L10n
  options: { text: L10n; correct?: boolean }[]
  why: L10n
}

export interface MoveStep {
  type: 'move'
  question: L10n
  accept: string[] // SAN
  /** Good moves that are not the lesson's idea: "good, but look for the plan". */
  alsoGood?: string[]
  why: L10n
}

export interface StrategyLesson {
  id: string
  title: L10n
  concept: L10n
  moves: string // SAN from the initial position
  orientation: 'white' | 'black'
  steps: (ChoiceStep | MoveStep)[]
}

export const STRATEGY: StrategyLesson[] = [
  {
    id: 'colle-plan',
    title: { en: 'Colle: the e4 break and the bishop on d3', es: 'Colle: la ruptura e4 y el alfil de d3' },
    concept: {
      en: 'In the Colle your pieces are set up behind the d4–e3 pawns. The plan is to prepare e4: it opens the centre and frees the c1-bishop, and the d3-bishop becomes an attacker against the king.',
      es: 'En el Colle tus piezas se ubican detrás de los peones d4–e3. El plan es preparar e4: abre el centro y libera al alfil de c1, y el alfil de d3 se vuelve un atacante contra el rey.',
    },
    moves: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O dxc5 Bxc5',
    orientation: 'white',
    steps: [
      {
        type: 'choice',
        question: { en: 'Which square does your d3-bishop aim at?', es: '¿A qué casilla apunta tu alfil de d3?' },
        options: [
          { text: { en: 'h7, next to the castled king', es: 'h7, al lado del rey enrocado' }, correct: true },
          { text: { en: 'a6', es: 'a6' } },
          { text: { en: 'd5', es: 'd5' } },
        ],
        why: {
          en: 'The b1–h7 diagonal points at h7. After e4–e5 the f6-knight, h7\'s defender, can be pushed away.',
          es: 'La diagonal b1–h7 apunta a h7. Después de e4–e5 se puede echar al caballo de f6, el defensor de h7.',
        },
      },
      {
        type: 'choice',
        question: { en: 'What is White\'s typical plan here?', es: '¿Cuál es el plan típico de las blancas acá?' },
        options: [
          { text: { en: 'The central break e4', es: 'La ruptura central e4' }, correct: true },
          { text: { en: 'Push g4–g5 at once', es: 'Avanzar g4–g5 enseguida' } },
          { text: { en: 'Trade queens', es: 'Cambiar damas' } },
        ],
        why: {
          en: 'Nbd2, c3 and the bishop on d3 all support e4. It is the move the whole setup was built for.',
          es: 'Cbd2, c3 y el alfil de d3 apoyan e4. Es la jugada para la que se armó todo el esquema.',
        },
      },
      {
        type: 'move',
        question: { en: 'Play the plan move.', es: 'Jugá la jugada del plan.' },
        accept: ['e4'],
        alsoGood: ['h3', 'b4'],
        why: {
          en: 'e4! Stockfish rates it as good as the best move: the centre opens while your pieces are ready.',
          es: '¡e4! Stockfish la valora igual que la mejor: el centro se abre con tus piezas listas.',
        },
      },
    ],
  },
  {
    id: 'french-chain',
    title: { en: 'French: attack the base of the chain', es: 'Francesa: atacá la base de la cadena' },
    concept: {
      en: 'After 3.e5 both sides have pawn chains. Rule: attack the base of your opponent\'s chain (d4) first, the head (e5) later. Play on the side your pawns point to.',
      es: 'Después de 3.e5 los dos bandos tienen cadenas de peones. Regla: atacá primero la base de la cadena rival (d4) y después la cabeza (e5). Jugá en el flanco hacia el que apuntan tus peones.',
    },
    moves: 'e4 e6 d4 d5 e5',
    orientation: 'black',
    steps: [
      {
        type: 'choice',
        question: { en: 'Which white pawn do you attack first?', es: '¿Qué peón blanco atacás primero?' },
        options: [
          { text: { en: 'd4, the base of the chain', es: 'd4, la base de la cadena' }, correct: true },
          { text: { en: 'e5, the head', es: 'e5, la cabeza' } },
          { text: { en: 'f2', es: 'f2' } },
        ],
        why: {
          en: 'If the base falls, the whole chain is weakened. ...f6 against e5 is the second break, later.',
          es: 'Si cae la base, toda la cadena se debilita. ...f6 contra e5 es la segunda ruptura, más adelante.',
        },
      },
      {
        type: 'move',
        question: { en: 'Play the move that attacks the base.', es: 'Jugá la jugada que ataca la base.' },
        accept: ['c5'],
        alsoGood: ['Ne7', 'Bd7'],
        why: { en: '...c5 is Stockfish\'s best move here.', es: '...c5 es la mejor jugada según Stockfish.' },
      },
      {
        type: 'choice',
        question: { en: 'Which flank is yours as Black?', es: '¿Cuál es tu flanco con negras?' },
        options: [
          { text: { en: 'The queenside (…c5, …Qb6, …b5)', es: 'El flanco de dama (…c5, …Db6, …b5)' }, correct: true },
          { text: { en: 'The kingside', es: 'El flanco de rey' } },
        ],
        why: {
          en: 'Your chain e6–d5 points to the queenside; White\'s d4–e5 points to the kingside, where White attacks.',
          es: 'Tu cadena e6–d5 apunta al flanco de dama; la blanca d4–e5 apunta al flanco de rey, donde atacan las blancas.',
        },
      },
      {
        type: 'choice',
        question: { en: 'Which is Black\'s problem piece in the French?', es: '¿Cuál es la pieza problemática de las negras en la Francesa?' },
        options: [
          { text: { en: 'The c8-bishop', es: 'El alfil de c8' }, correct: true },
          { text: { en: 'The g8-knight', es: 'El caballo de g8' } },
          { text: { en: 'The queen', es: 'La dama' } },
        ],
        why: {
          en: 'It is blocked by its own pawns on light squares (e6, d5). Plans: trade it with …b6 and …Ba6, or …Bd7–b5.',
          es: 'Está trabado por sus propios peones en casillas blancas (e6, d5). Planes: cambiarlo con …b6 y …Aa6, o …Ad7–b5.',
        },
      },
    ],
  },
  {
    id: 'iqp',
    title: { en: 'The isolated queen\'s pawn', es: 'El peón aislado de dama' },
    concept: {
      en: 'An isolated d-pawn cannot be defended by pawns, but it gives space and open lines. The side with it wants activity and attack; the other side blockades the square in front and trades pieces.',
      es: 'Un peón d aislado no puede ser defendido por peones, pero da espacio y líneas abiertas. El bando que lo tiene busca actividad y ataque; el otro bloquea la casilla de adelante y cambia piezas.',
    },
    moves: 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O dxc5 Bxc5',
    orientation: 'white',
    steps: [
      {
        type: 'choice',
        question: { en: 'Which square should White control?', es: '¿Qué casilla tienen que dominar las blancas?' },
        options: [
          { text: { en: 'd4, in front of the pawn', es: 'd4, delante del peón' }, correct: true },
          { text: { en: 'h7', es: 'h7' } },
          { text: { en: 'a7', es: 'a7' } },
        ],
        why: {
          en: 'A piece on d4 blocks the pawn and cannot be chased by pawns. It is the ideal blockade square.',
          es: 'Una pieza en d4 bloquea al peón y no puede ser echada por peones. Es la casilla ideal de bloqueo.',
        },
      },
      {
        type: 'choice',
        question: { en: 'Which trades help White (against the isolated pawn)?', es: '¿Qué cambios le convienen a las blancas (contra el peón aislado)?' },
        options: [
          { text: { en: 'Trading pieces, especially minor pieces', es: 'Cambiar piezas, sobre todo piezas menores' }, correct: true },
          { text: { en: 'Avoiding all trades', es: 'Evitar todos los cambios' } },
        ],
        why: {
          en: 'With fewer pieces, the isolated pawn\'s dynamism disappears and it becomes a target in the endgame.',
          es: 'Con menos piezas, el dinamismo del peón aislado desaparece y se vuelve un objetivo en el final.',
        },
      },
      {
        type: 'choice',
        question: { en: 'And if YOU have the isolated pawn?', es: '¿Y si el peón aislado lo tenés VOS?' },
        options: [
          { text: { en: 'Active pieces, kingside attack and the …d4 break', es: 'Piezas activas, ataque al rey y la ruptura …d4' }, correct: true },
          { text: { en: 'Trade everything and go to the endgame', es: 'Cambiar todo e ir al final' } },
        ],
        why: {
          en: 'Use the space and open lines now; the pawn becomes weak only when pieces come off.',
          es: 'Aprovechá ahora el espacio y las líneas abiertas; el peón se vuelve débil recién cuando se cambian piezas.',
        },
      },
    ],
  },
  {
    id: 'carlsbad',
    title: { en: 'Carlsbad structure: the minority attack', es: 'Estructura Carlsbad: el ataque de minorías' },
    concept: {
      en: 'This structure arises from the Exchange Queen\'s Gambit (and similar French lines). White has 2 queenside pawns against Black\'s 3, and still attacks there with b4–b5.',
      es: 'Esta estructura sale del Gambito de Dama del Cambio (y líneas parecidas de la Francesa). Las blancas tienen 2 peones en el flanco de dama contra 3 negros, y aun así atacan ahí con b4–b5.',
    },
    moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8',
    orientation: 'white',
    steps: [
      {
        type: 'choice',
        question: { en: 'Which queenside plan is typical for White here?', es: '¿Qué plan típico tienen las blancas en el flanco de dama?' },
        options: [
          { text: { en: 'b4–b5 (minority attack)', es: 'b4–b5 (ataque de minorías)' }, correct: true },
          { text: { en: 'a4–a5–a6', es: 'a4–a5–a6' } },
          { text: { en: 'Nothing: only the kingside matters', es: 'Nada: solo importa el flanco de rey' } },
        ],
        why: {
          en: 'Usually prepared with Rab1 and a3, then b4–b5. It is a slow plan; Stockfish also likes h3 first here.',
          es: 'Se prepara con Tab1 y a3, y después b4–b5. Es un plan lento; acá Stockfish también aprueba h3 primero.',
        },
      },
      {
        type: 'choice',
        question: { en: 'What does b5 achieve?', es: '¿Qué logra b5?' },
        options: [
          { text: { en: 'After b5xc6 it leaves Black a weak pawn on c6 (or d5)', es: 'Después de b5xc6 le deja a las negras un peón débil en c6 (o d5)' }, correct: true },
          { text: { en: 'It wins the d5 pawn by force', es: 'Gana el peón d5 por la fuerza' } },
          { text: { en: 'It opens the h-file', es: 'Abre la columna h' } },
        ],
        why: {
          en: 'The goal is a structural weakness to attack with pieces, not immediate material.',
          es: 'El objetivo es una debilidad estructural para atacar con piezas, no material inmediato.',
        },
      },
    ],
  },
]
