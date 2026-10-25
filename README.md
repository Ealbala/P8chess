# ♞ Pocho Chess — *Camino a GM Pocho*

Tu entrenador personal de ajedrez: una app web instalable (PWA) que funciona en iPhone, tablet y computadora.
Publicada en https://p8chess.vercel.app

**Estado actual: Fase 2 (integración con Chess.com).** Lo que todavía no existe aparece marcado en la app como *"Todavía no disponible"* y en la hoja de ruta de **Ajustes**.

## Qué hace la Fase 1

| Función | Estado |
|---|---|
| Onboarding: rating actual (Rapid/Blitz/Bullet), objetivo, partidas semanales y minutos diarios | ✅ |
| Dashboard "My Chess Journey": Elo actual/objetivo, puntos que faltan, objetivos intermedios, gráfico, racha, minutos, partidas y ejercicios de la semana, nivel/XP, logros | ✅ |
| Today's Training: plan diario según la duración (10–60 min), se marca solo cuando hacés la actividad | ✅ |
| Ejercicios tácticos, de cálculo y de finales (1.385 problemas reales de Lichess, licencia CC0, funcionan sin conexión) | ✅ |
| Dificultad básica: elige problemas cerca de tu "rating de práctica" y repite los que fallaste al día siguiente | ✅ |
| A ciegas, Nivel 1: encontrar casillas y color de casillas (rondas de 60 s) | ✅ |
| Partidas: registro manual (presencial / otros sitios), objetivo semanal por modalidad, G/P/T | ✅ |
| Tablero interactivo libre: mover (arrastrar o tocar), avanzar/retroceder, girar, cargar FEN/PGN | ✅ |
| Modo claro/oscuro, inglés/español, exportar/importar copia de seguridad | ✅ |
| **Fase 2:** importar partidas de Chess.com (PGN, resultado, color, ritmo, rating, apertura, reloj), sin duplicados, sincronización automática al abrir | ✅ |
| **Fase 2:** "Revisá antes de jugar otra": cada partida de tu ritmo principal queda pendiente hasta que la revisás | ✅ |
| **Fase 2:** revisión de partida: reproducir jugadas con reloj, marcar el momento clave, etiquetar el tipo de error (autoevaluación) y escribir la lección | ✅ |
| **Fase 2:** estadísticas por color, aperturas y manejo del tiempo; aviso de "tilt" tras 2 derrotas seguidas | ✅ |
| Análisis con Stockfish, My Mistake Library | ⏳ Fase 3 |
| A ciegas niveles 2–5, repetición espaciada completa, aperturas | ⏳ Fase 4 |
| Coach con IA | ⏳ Fase 5 |
| Notificaciones push | ⏳ Fase 6 |

### Cómo se calculan las métricas (sin números inventados)

- **Rating actual**: el último valor que registraste (al cargar una partida o en Ajustes). En la Fase 2 vendrá directo de Chess.com.
- **Racha**: días seguidos con al menos un ejercicio, ronda a ciegas o partida revisada. Se perdona **1 día de descanso por semana** (no suma, pero no corta la racha).
- **Minutos**: tiempo real que pasaste resolviendo ejercicios y rondas (máx. 10 min por ejercicio, por si dejás la app abierta).
- **XP**: ejercicio correcto 10, fallado 2, ronda a ciegas 5 + 1 por acierto, partida revisada 15.
- **Rating de práctica**: estimación interna tipo Elo contra el rating de cada problema de Lichess. **No es un rating oficial.**
- **Fortalezas/debilidades**: % de acierto por tema táctico en los ejercicios de la app (mín. 5 intentos), más los tipos de error que **vos** marcaste al revisar partidas. El análisis con motor llega en la Fase 3.

### Chess.com: qué se importa y qué no

- Se usa la [API pública](https://www.chess.com/news/view/published-data-api): solo datos públicos, sin contraseña.
- Primera sincronización: últimos 6 meses. Después, solo los meses nuevos. Las partidas se identifican por su `uuid`, así que nunca se duplican.
- Se importan rápidas, blitz y bullet (no Daily ni variantes).
- **No incluye análisis de motor.** La "precisión" solo aparece si revisaste esa partida en Chess.com.
- Los datos de tiempo salen de los comentarios `[%clk]` del PGN.
- Partidas para revisar: las de tu ritmo principal jugadas desde que empezaste a usar la app (las anteriores quedan como historial).

## Stack (y por qué)

- **React + TypeScript + Vite**: la herramienta estándar para apps web modernas.
- **Tailwind CSS**: estilos rápidos y responsive.
- **chess.js** (reglas) + **react-chessboard** (tablero táctil).
- **Dexie (IndexedDB)**: base de datos dentro del navegador → **costo $0, sin servidor**.
- **vite-plugin-pwa**: permite instalarla en la pantalla de inicio del iPhone y usarla sin conexión.

Todo corre en el navegador. Más adelante: Stockfish también corre en el navegador (WebAssembly), y la API de Chess.com permite llamadas directas desde el navegador (lo verifiqué). El único componente que va a necesitar un servidor es el **coach de IA** (para no exponer la clave de la API); ahí entra **Python/FastAPI** o una función serverless.

## Cómo ejecutarla en tu computadora

### 1. Instalar programas (una sola vez)

1. **Node.js** (versión LTS, 20 o superior): https://nodejs.org → descargar e instalar.
2. **Git**: https://git-scm.com/downloads (en Mac ya suele venir).
3. **Visual Studio Code** (editor recomendado): https://code.visualstudio.com

Comprobá en la terminal:
```bash
node -v   # debería mostrar v20.x o superior
git --version
```

### 2. Descargar el proyecto
```bash
git clone https://github.com/ealbala/p8chess.git
cd p8chess
git checkout claude/chess-coach-app-c9nmwh   # la rama donde está la Fase 1
npm install                                 # descarga las librerías (tarda 1–2 min)
```

### 3. Abrirla
```bash
npm run dev
```
Abrí la dirección `http://localhost:5173` que aparece en la terminal. Para cortar: `Ctrl + C`.

**Probar desde el iPhone en la misma red WiFi:** la terminal también muestra una dirección `Network: http://192.168.x.x:5173`. Abrila en Safari. (Para *instalarla* como app hace falta HTTPS → ver la sección siguiente.)

### Otros comandos
```bash
npm test          # corre las pruebas automáticas
npm run build     # genera la versión final en la carpeta dist/
npm run preview   # sirve esa versión final localmente
```

## Usarla en el iPhone (gratis)

Para instalarla como app, tiene que estar publicada con HTTPS. La opción más simple y gratuita es **Vercel** (funciona con repos privados):

1. Entrá a https://vercel.com y registrate con tu cuenta de GitHub.
2. *Add New → Project* → elegí el repo `p8chess` → *Deploy* (detecta Vite solo).
3. Te da una URL tipo `https://p8chess.vercel.app`. Cada vez que se suban cambios, se actualiza sola.
4. En el iPhone: abrí la URL en **Safari** → botón **Compartir** → **Agregar a pantalla de inicio**.

> ⚠️ **Tus datos se guardan en el dispositivo**, no en la nube. Los datos del iPhone y los de la computadora son independientes. Usá **Ajustes → Exportar datos** cada tanto como copia de seguridad. (La sincronización entre dispositivos se puede agregar más adelante.)

## Estructura del código

```
src/
  main.tsx            arranque de la app
  App.tsx             navegación inferior y rutas
  lib/
    db.ts             base de datos local (tablas y copia de seguridad)
    stats.ts          cálculos: racha, XP, rating, temas fuertes/débiles
    plan.ts           plan diario y su progreso
    puzzles.ts        carga y elección de ejercicios
    i18n.tsx          textos en inglés y español
  components/         tablero, entrenador de ejercicios, ejercicio a ciegas, botones
  pages/              Dashboard, Train, Games, Board, Settings, Onboarding
public/data/puzzles.json   problemas de Lichess (generados con scripts/build_puzzles.py)
```
