// Opening repertoire content. Lines are mainstream theory, kept short (7–10 moves) so they
// are easy to memorise. Every move is checked for legality by src/lib/__tests__/openings.test.ts.
// `notes` are keyed by ply number (1 = White's first move) and explain the move just played.

export type L10n = { en: string; es: string }

export interface OpeningLine {
  id: string
  name: L10n
  moves: string // SAN, space separated, no move numbers
  notes?: Record<number, L10n>
}

export interface Opening {
  id: string
  color: 'white' | 'black'
  name: L10n
  description: L10n
  /** Openings you already play (detected from your Chess.com games). */
  starter: boolean
  lines: OpeningLine[]
}

export const OPENINGS: Opening[] = [
  {
    id: 'colle',
    color: 'white',
    starter: true,
    name: { en: 'Colle System', es: 'Sistema Colle' },
    description: {
      en: 'Your current White setup: d4, Nf3, e3, Bd3, c3, O-O, Nbd2 and the e4 break. Solid and easy to play.',
      es: 'Tu esquema actual con blancas: d4, Cf3, e3, Ad3, c3, enroque, Cbd2 y la ruptura e4. Sólido y fácil de jugar.',
    },
    lines: [
      {
        id: 'colle-main',
        name: { en: 'Main line: the e4 break', es: 'Línea principal: la ruptura e4' },
        moves: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O dxc5 Bxc5 e4',
        notes: {
          5: { en: 'e3 frees the light-squared bishop. The c1-bishop stays inside the chain: that is the price of the Colle.', es: 'e3 libera al alfil de casillas blancas. El alfil de c1 queda encerrado: es el precio del Colle.' },
          7: { en: 'The bishop aims at h7 — your key attacking piece.', es: 'El alfil apunta a h7: tu pieza clave para atacar.' },
          9: { en: 'c3 supports d4 against the ...c5 pressure.', es: 'c3 sostiene d4 contra la presión de ...c5.' },
          11: { en: 'The knight goes to d2 to support e4.', es: 'El caballo va a d2 para apoyar e4.' },
          15: { en: 'Take on c5 first: Black spends a move recapturing.', es: 'Primero cambiá en c5: las negras gastan una jugada en recapturar.' },
          17: { en: 'The Colle plan: e4 opens the center and your bishops come to life.', es: 'El plan del Colle: e4 abre el centro y tus alfiles cobran vida.' },
        },
      },
      {
        id: 'colle-bf5',
        name: { en: 'Against ...Bf5', es: 'Contra ...Af5' },
        moves: 'd4 d5 Nf3 Nf6 e3 Bf5 Bd3 Bxd3 Qxd3 e6 O-O Be7 c4 O-O Nc3',
        notes: {
          7: { en: 'Offer the trade: Black\'s f5-bishop is their best minor piece.', es: 'Ofrecé el cambio: el alfil de f5 es la mejor pieza menor de las negras.' },
          13: { en: 'Without light-squared bishops, c4 is the active plan: pressure on d5.', es: 'Sin alfiles de casillas blancas, c4 es el plan activo: presión sobre d5.' },
        },
      },
      {
        id: 'colle-kid',
        name: { en: 'Against the King\'s Indian setup (...g6)', es: 'Contra el esquema india de rey (...g6)' },
        moves: 'd4 Nf6 Nf3 g6 e3 Bg7 Bd3 O-O O-O d6 c3 Nbd7 Nbd2 e5 e4',
        notes: {
          11: { en: 'c3 keeps d4 solid if Black plays ...e5.', es: 'c3 mantiene firme d4 si las negras juegan ...e5.' },
          15: { en: 'Against ...g6 setups, take your share of the center with e4.', es: 'Contra esquemas con ...g6, ocupá tu parte del centro con e4.' },
        },
      },
      {
        id: 'colle-nc6',
        name: { en: 'Against ...Nc6', es: 'Contra ...Cc6' },
        moves: 'd4 d5 Nf3 Nc6 e3 Bg4 Be2 e6 O-O Nf6 c4 Bd6 Nc3 O-O b3',
        notes: {
          7: { en: 'Be2 breaks the pin calmly; Bd3 is less useful when the bishop on g4 controls f3.', es: 'Ae2 rompe la clavada con calma.' },
          11: { en: 'The knight on c6 blocks Black\'s c-pawn, so c4 hits d5 where it can\'t be supported by ...c6.', es: 'El caballo en c6 bloquea el peón c negro: c4 ataca d5 y no lo pueden sostener con ...c6.' },
        },
      },
      {
        id: 'colle-e6',
        name: { en: 'Against 1...e6 / 2...e6', es: 'Contra 1...e6 / 2...e6' },
        moves: 'd4 e6 Nf3 d5 e3 Nf6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O dxc5 Bxc5 e4',
        notes: {
          5: { en: 'Same Colle setup: this transposes to the main line.', es: 'El mismo esquema Colle: esto transpone a la línea principal.' },
        },
      },
      {
        id: 'colle-d6',
        name: { en: 'Against 1...d6 / 1...g6', es: 'Contra 1...d6 / 1...g6' },
        moves: 'd4 d6 Nf3 Nf6 e3 g6 Bd3 Bg7 O-O O-O c3 Nbd7 Nbd2 e5 e4',
        notes: {
          15: { en: 'Same plan as against the King\'s Indian: claim the center with e4.', es: 'El mismo plan que contra la india de rey: reclamá el centro con e4.' },
        },
      },
      {
        id: 'colle-c6',
        name: { en: 'Against 1...c6 (Slav setup)', es: 'Contra 1...c6 (esquema eslavo)' },
        moves: 'd4 c6 Nf3 d5 e3 Bf5 Bd3 Bxd3 Qxd3 e6 O-O Nf6 c4',
        notes: {
          7: { en: 'Trade off the f5-bishop, as in the ...Bf5 line.', es: 'Cambiá el alfil de f5, como en la línea de ...Af5.' },
          13: { en: 'c4 challenges d5 now that the light bishops are gone.', es: 'c4 desafía d5 ahora que no hay alfiles de casillas blancas.' },
        },
      },
      {
        id: 'colle-englund',
        name: { en: 'Against 1...e5 (Englund Gambit)', es: 'Contra 1...e5 (Gambito Englund)' },
        moves: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Nc3 Nxe5 e4 Nxf3+ Qxf3',
        notes: {
          3: { en: 'Take the pawn: the Englund Gambit is dubious. (2.Nf3 allows ...e4 with an annoying pawn.)', es: 'Tomá el peón: el Gambito Englund es dudoso. (2.Cf3 permite ...e4 con un peón molesto.)' },
          7: { en: 'Simple development. Avoid 4.Bf4?! Qb4+ 5.Bd2 Qxb2 6.Bc3?? Bb4! — the famous Englund trap.', es: 'Desarrollo simple. Evitá 4.Af4?! Db4+ 5.Ad2 Dxb2 6.Ac3?? Ab4!: la famosa trampa del Englund.' },
          9: { en: 'Occupy the center: you are clearly ahead in development.', es: 'Ocupá el centro: estás claramente más desarrollado.' },
        },
      },
    ],
  },
  {
    id: 'french',
    color: 'black',
    starter: true,
    name: { en: 'French Defense', es: 'Defensa Francesa' },
    description: {
      en: 'Your current answer to 1.e4: ...e6 and ...d5. Plans: hit White\'s chain with ...c5 and ...f6.',
      es: 'Tu respuesta actual a 1.e4: ...e6 y ...d5. Planes: atacar la cadena blanca con ...c5 y ...f6.',
    },
    lines: [
      {
        id: 'french-exchange',
        name: { en: 'Exchange Variation', es: 'Variante del Cambio' },
        moves: 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O Bg5 Bg4',
        notes: {
          6: { en: 'Symmetrical structure: the game is about piece activity, not pawn breaks.', es: 'Estructura simétrica: la partida se trata de actividad de piezas, no de rupturas.' },
          14: { en: 'Develop actively and copy the pin. Next: ...Nbd7, ...c6, ...Re8.', es: 'Desarrollá activo y devolvé la clavada. Después: ...Cbd7, ...c6, ...Te8.' },
        },
      },
      {
        id: 'french-advance',
        name: { en: 'Advance Variation', es: 'Variante del Avance' },
        moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Be2 cxd4 cxd4 Nh6 Nc3 Nf5 Na4 Qa5+ Bd2 Bb4',
        notes: {
          6: { en: 'Attack the base of White\'s chain (d4) right away.', es: 'Atacá ya la base de la cadena blanca (d4).' },
          10: { en: 'Three attackers on d4: the c5-pawn, Nc6 and Qb6.', es: 'Tres atacantes sobre d4: el peón c5, Cc6 y Db6.' },
          14: { en: 'The knight heads for f5 to hit d4 once more.', es: 'El caballo va a f5 para atacar d4 una vez más.' },
          20: { en: 'Trade off d4\'s defender.', es: 'Cambiá al defensor de d4.' },
        },
      },
      {
        id: 'french-rubinstein',
        name: { en: 'Rubinstein: 3.Nc3 dxe4', es: 'Rubinstein: 3.Cc3 dxe4' },
        moves: 'e4 e6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6 Nxf6+ Nxf6 Bd3 c5 dxc5 Bxc5 O-O O-O',
        notes: {
          6: { en: 'Your move! Give up the center for quick, solid development.', es: '¡Tu jugada! Cedés el centro a cambio de un desarrollo rápido y sólido.' },
          8: { en: '...Nd7 prepares ...Ngf6 so you can recapture with a knight, keeping a healthy structure.', es: '...Cd7 prepara ...Cgf6 para recapturar con caballo y mantener una buena estructura.' },
          14: { en: 'The key freeing move: challenge d4.', es: 'La jugada liberadora clave: desafiar d4.' },
        },
      },
      {
        id: 'french-2nf3',
        name: { en: '2.Nf3 and 3.Nc3', es: '2.Cf3 y 3.Cc3' },
        moves: 'e4 e6 Nf3 d5 Nc3 Nf6 e5 Nfd7 d4 c5 dxc5 Nc6 Bf4 Bxc5 Bd3 f6',
        notes: {
          10: { en: 'Same French plan: hit the chain with ...c5.', es: 'El mismo plan francés: atacar la cadena con ...c5.' },
          16: { en: 'Second break: ...f6 attacks the head of the chain (e5).', es: 'Segunda ruptura: ...f6 ataca la cabeza de la cadena (e5).' },
        },
      },
      {
        id: 'french-2nf3-exd5',
        name: { en: '2.Nf3 d5 3.exd5', es: '2.Cf3 d5 3.exd5' },
        moves: 'e4 e6 Nf3 d5 exd5 exd5 d4 Nf6 Bd3 Bd6 O-O O-O',
        notes: {
          8: { en: 'This transposes to the Exchange Variation: develop and castle.', es: 'Esto transpone a la Variante del Cambio: desarrollá y enrocá.' },
        },
      },
      {
        id: 'french-2nf3-e5',
        name: { en: '2.Nf3 d5 3.e5', es: '2.Cf3 d5 3.e5' },
        moves: 'e4 e6 Nf3 d5 e5 c5 d4 Nc6 c3 Qb6',
        notes: {
          6: { en: 'Against any e5 advance: ...c5 at once.', es: 'Contra cualquier avance e5: ...c5 enseguida.' },
          10: { en: 'Transposes to the Advance Variation.', es: 'Transpone a la Variante del Avance.' },
        },
      },
      {
        id: 'french-kia',
        name: { en: 'Against 2.d3 (King\'s Indian Attack)', es: 'Contra 2.d3 (Ataque indio de rey)' },
        moves: 'e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5 g3 Nc6 Bg2 Be7 O-O O-O',
        notes: {
          8: { en: 'Grab queenside space with ...c5, ...Nc6 and later ...b5.', es: 'Ganá espacio en el flanco de dama con ...c5, ...Cc6 y más tarde ...b5.' },
        },
      },
    ],
  },
  {
    id: 'qgd',
    color: 'black',
    starter: true,
    name: { en: 'Against 1.d4: ...e6 and ...d5', es: 'Contra 1.d4: ...e6 y ...d5' },
    description: {
      en: 'Your current answer to 1.d4, close to the Queen\'s Gambit Declined. Solid center, ...c5 as the main break.',
      es: 'Tu respuesta actual a 1.d4, cercana al Gambito de Dama Declinado. Centro sólido y ...c5 como ruptura principal.',
    },
    lines: [
      {
        id: 'qgd-london',
        name: { en: 'Against the London (Bf4)', es: 'Contra el London (Af4)' },
        moves: 'd4 e6 Bf4 d5 e3 c5 c3 Nc6 Nd2 Bd6 Bg3 Nf6',
        notes: {
          6: { en: 'Strike the center with ...c5 before White completes the setup.', es: 'Golpeá el centro con ...c5 antes de que las blancas completen el esquema.' },
          10: { en: 'Challenge White\'s best piece: offer to trade the bishop.', es: 'Desafiá a la mejor pieza blanca: ofrecé el cambio de alfiles.' },
        },
      },
      {
        id: 'qgd-main',
        name: { en: 'Queen\'s Gambit Declined (Tartakower)', es: 'Gambito de Dama Declinado (Tartakower)' },
        moves: 'd4 e6 c4 d5 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
        notes: {
          8: { en: 'Unpin calmly; the bishop is safe on e7.', es: 'Desclavá con calma; el alfil está seguro en e7.' },
          14: { en: '...b6 and ...Bb7 solve the problem of the light-squared bishop.', es: '...b6 y ...Ab7 resuelven el problema del alfil de casillas blancas.' },
        },
      },
      {
        id: 'qgd-colle',
        name: { en: 'Against the Colle (Nf3, e3)', es: 'Contra el Colle (Cf3, e3)' },
        moves: 'd4 e6 Nf3 d5 e3 Nf6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O',
        notes: {
          8: { en: '...c5 before White plays e4: you know this plan from the other side!', es: '...c5 antes de que las blancas jueguen e4: ¡este plan lo conocés desde el otro lado!' },
        },
      },
    ],
  },
  {
    id: 'london',
    color: 'white',
    starter: false,
    name: { en: 'London System', es: 'Sistema Londres' },
    description: {
      en: 'The natural next step from the Colle: same structure, but the dark-squared bishop develops to f4 before e3.',
      es: 'El paso natural después del Colle: misma estructura, pero el alfil de casillas negras sale a f4 antes de e3.',
    },
    lines: [
      {
        id: 'london-main',
        name: { en: 'Main line against ...d5', es: 'Línea principal contra ...d5' },
        moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
        notes: {
          3: { en: 'The difference from the Colle: the bishop comes out before e3.', es: 'La diferencia con el Colle: el alfil sale antes de e3.' },
          13: { en: 'Keep the bishop. If ...Bxg3, hxg3 opens the h-file for your rook.', es: 'Mantené el alfil. Si ...Axg3, hxg3 abre la columna h para tu torre.' },
        },
      },
      {
        id: 'london-kid',
        name: { en: 'Against ...g6', es: 'Contra ...g6' },
        moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3',
        notes: {
          11: { en: 'h3 gives the bishop a retreat on h2 against ...Nh5.', es: 'h3 le da al alfil la retirada a h2 contra ...Ch5.' },
        },
      },
    ],
  },
  {
    id: 'italian',
    color: 'white',
    starter: false,
    name: { en: 'Italian Game (1.e4)', es: 'Apertura Italiana (1.e4)' },
    description: {
      en: 'A classical 1.e4 option: quick development, Bc4 aiming at f7, and a slow c3–d3 center.',
      es: 'Una opción clásica con 1.e4: desarrollo rápido, Ac4 apuntando a f7 y un centro lento con c3–d3.',
    },
    lines: [
      {
        id: 'italian-pianissimo',
        name: { en: 'Giuoco Pianissimo (...Bc5)', es: 'Giuoco Pianissimo (...Ac5)' },
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3',
        notes: {
          5: { en: 'The bishop targets f7, the weakest point in Black\'s camp.', es: 'El alfil apunta a f7, el punto más débil del campo negro.' },
          7: { en: 'c3 prepares d4 and gives the bishop a retreat.', es: 'c3 prepara d4 y le da una retirada al alfil.' },
          9: { en: 'Slow and solid: protect e4 and keep the option of d4 later.', es: 'Lento y sólido: protegé e4 y guardá la opción de d4 para después.' },
        },
      },
      {
        id: 'italian-two-knights',
        name: { en: 'Against ...Nf6 (Two Knights)', es: 'Contra ...Cf6 (Dos Caballos)' },
        moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
        notes: {
          7: { en: 'd3 protects e4 and avoids the sharp 4.Ng5 lines.', es: 'd3 protege e4 y evita las líneas filosas de 4.Cg5.' },
        },
      },
    ],
  },
  {
    id: 'caro',
    color: 'black',
    starter: false,
    name: { en: 'Caro-Kann Defense', es: 'Defensa Caro-Kann' },
    description: {
      en: 'A solid alternative to the French against 1.e4: the light-squared bishop gets out before ...e6.',
      es: 'Una alternativa sólida a la Francesa contra 1.e4: el alfil de casillas blancas sale antes de ...e6.',
    },
    lines: [
      {
        id: 'caro-classical',
        name: { en: 'Classical Variation', es: 'Variante Clásica' },
        moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6',
        notes: {
          8: { en: 'The point of the Caro-Kann: the bishop develops before ...e6.', es: 'La idea de la Caro-Kann: el alfil se desarrolla antes de ...e6.' },
          12: { en: '...h6 gives the bishop a retreat so h4–h5 doesn\'t trap it.', es: '...h6 le da una retirada al alfil para que h4–h5 no lo atrape.' },
        },
      },
      {
        id: 'caro-advance',
        name: { en: 'Advance Variation', es: 'Variante del Avance' },
        moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4',
        notes: {
          10: { en: 'Same idea as in the French: attack d4 with ...c5.', es: 'La misma idea que en la Francesa: atacar d4 con ...c5.' },
        },
      },
      {
        id: 'caro-exchange',
        name: { en: 'Exchange Variation', es: 'Variante del Cambio' },
        moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7',
        notes: {
          12: { en: 'Develop the bishop actively before ...e6 closes it in.', es: 'Desarrollá el alfil activamente antes de que ...e6 lo encierre.' },
          14: { en: '...Qd7 defends b7 and keeps the pieces connected.', es: '...Dd7 defiende b7 y mantiene las piezas conectadas.' },
        },
      },
    ],
  },
]

export const DEFAULT_REPERTOIRE = OPENINGS.filter((o) => o.starter).map((o) => o.id)

export function findLine(lineId: string) {
  for (const o of OPENINGS) {
    const line = o.lines.find((l) => l.id === lineId)
    if (line) return { opening: o, line }
  }
  return null
}
