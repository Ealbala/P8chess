// Stockfish 17.1 (lite, single-threaded WASM) running in a Web Worker on your device.
// Files: public/engine/stockfish.js + stockfish.wasm (GPL v3, see public/engine/README.txt).

export interface EngineResult {
  /** Best move in UCI notation, e.g. "e2e4". */
  best: string
  /** Score from the side to move's point of view, in centipawns (mates mapped to ±10000). */
  cp: number
  mate: number | null
  depth: number
  /** Principal variation in UCI. */
  pv: string[]
}

type Pending = { fen: string; depth: number; resolve: (r: EngineResult) => void; reject: (e: unknown) => void }

export class Engine {
  /** UCI commands sent once after start-up, e.g. "setoption name Skill Level value 5". */
  constructor(private setup: string[] = []) {}

  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private queue: Pending[] = []
  private busy = false
  private last: EngineResult | null = null
  private current: Pending | null = null

  private start() {
    this.ready ??= new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish.js`)
      } catch (e) {
        reject(e)
        return
      }
      this.worker.onerror = (e) => reject(e)
      this.worker.onmessage = (e) => {
        const line = String(e.data)
        if (line === 'uciok') {
          this.setup.forEach((cmd) => this.worker!.postMessage(cmd))
          this.worker!.postMessage('isready')
        }
        else if (line === 'readyok' && !this.busy) resolve()
        else this.onLine(line)
      }
      this.worker.postMessage('uci')
    })
    return this.ready
  }

  private onLine(line: string) {
    if (!this.current) return
    if (line.startsWith('info depth') && line.includes(' pv ') && !line.includes('multipv 2')) {
      const depth = Number(line.match(/ depth (\d+)/)?.[1] ?? 0)
      const cpMatch = line.match(/ score cp (-?\d+)/)
      const mateMatch = line.match(/ score mate (-?\d+)/)
      const mate = mateMatch ? Number(mateMatch[1]) : null
      const cp = mate !== null ? Math.sign(mate || -1) * (10000 - Math.abs(mate) * 10) : Number(cpMatch?.[1] ?? 0)
      const pv = line.split(' pv ')[1].trim().split(' ')
      this.last = { best: pv[0], cp, mate, depth, pv }
    } else if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1]
      const job = this.current
      const result: EngineResult =
        this.last && this.last.best === best
          ? this.last
          : { best, cp: this.last?.cp ?? 0, mate: this.last?.mate ?? null, depth: this.last?.depth ?? 0, pv: [best] }
      this.current = null
      this.last = null
      this.busy = false
      if (best === '(none)') job.reject(new Error('no legal moves'))
      else job.resolve(result)
      this.next()
    }
  }

  private next() {
    if (this.busy || !this.queue.length || !this.worker) return
    this.current = this.queue.shift()!
    this.busy = true
    this.worker.postMessage(`position fen ${this.current.fen}`)
    // Depth limit, with a time cap so slow phones never hang on one position.
    this.worker.postMessage(`go depth ${this.current.depth} movetime 4000`)
  }

  terminate() {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
  }

  async analyse(fen: string, depth = 12): Promise<EngineResult> {
    await this.start()
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, resolve, reject })
      this.next()
    })
  }
}

export const engine = new Engine()

/**
 * A separate, weaker engine to play against. Stockfish "Skill Level" 0–20; low levels
 * make deliberate mistakes. Depth is kept low so it answers quickly.
 */
export function createSparringEngine(skill: number) {
  return new Engine([`setoption name Skill Level value ${Math.max(0, Math.min(20, skill))}`])
}

/** Lichess win-probability model: centipawns → winning chances 0..100 for the side to move. */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

export function formatEval(cp: number, mate: number | null): string {
  if (mate !== null) return `${mate < 0 ? '-' : ''}M${Math.abs(mate)}`
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
}
