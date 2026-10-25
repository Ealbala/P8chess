# ♞ Pocho Chess — *Camino a GM Pocho*

Tu entrenador personal de ajedrez: una app web instalable (PWA) que funciona en iPhone, tablet y computadora.
Publicada en https://p8chess.vercel.app

**Estado actual: las 6 fases implementadas.** El coach de IA necesita una clave de API (ver abajo). Lo que todavía no existe aparece marcado en la app como *"Todavía no disponible"* y en la hoja de ruta de **Ajustes**.

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

## Aperturas, áreas y prioridad (Fase 4, parte)

- **Repertorio** (`src/data/openings.ts`): tu Colle (blancas), Francesa y ...e6/...d5 contra 1.d4 (negras), detectados de tus partidas. Para aprender: Sistema Londres, Italiana y Caro-Kann. Cada jugada está verificada por un test de legalidad.
- **Aprender / Repasar**: en modo aprender, una flecha marca tu jugada y una nota la explica; en repaso jugás de memoria. Repetición espaciada: 1, 3, 7, 14, 30 y 60 días; un error vuelve la línea a mañana.
- **Tus partidas vs. tu repertorio**: hasta dónde llegás dentro del libro, qué jugadas rivales todavía no cubrís y dónde te salís vos.
- **Tácticas típicas de cada apertura**: ejercicios de Lichess etiquetados con esa apertura.
- **Medio juego**: ejercicios de Lichess de medio juego con temas de ataque, defensa y jugadas tranquilas.
- **Prioridad**: % de acierto en tus últimos 30 intentos por área (mín. 10 para clasificar). El área más floja recibe +50% en el plan diario.

## Análisis con Stockfish y retos (Fase 3)

- **Stockfish 17.1 lite** corre en tu dispositivo (WebAssembly, `public/engine/`, ~7 MB, se descarga la primera vez que se usa). Sin servidor y sin costo.
- Mientras la app está abierta analiza en segundo plano tus últimas 30 partidas de tu ritmo principal y cada partida nueva (profundidad 12).
- Criterio (modelo de probabilidad de ganar de Lichess): pérdida de 10+ puntos = imprecisión, 20+ = error, 30+ = error grave. Los errores y errores graves (si la posición no estaba ya perdida) van a **Mi biblioteca de errores**.
- **Entrenamiento con tus errores**: ves la posición de tu partida, buscás la mejor jugada y después la app muestra la mejor (verde), la que jugaste en la partida (roja) y tu respuesta (azul), con evaluaciones y la línea recomendada. Una jugada distinta de la del motor cuenta como correcta si pierde menos de 5 puntos de probabilidad. Repetición espaciada.
- **Prioridad**: con 5 o más partidas analizadas, el área a reforzar es la fase (apertura / medio juego / final) con más errores cada 100 jugadas tuyas.
- **Reto de hoy**: completar el plan diario (racha de días con el reto completo, +25 XP). **Reto semanal**: jugar las partidas semanales de tu ritmo principal (racha de semanas, +50 XP).
- Al llegar a tu objetivo, la app propone el siguiente (+100).

## Fases 4–6

- **A ciegas, 5 niveles** (Entrenar → A ciegas): coordenadas; movimientos (saltos de caballo, diagonales); memoria (posición unos segundos y preguntas por casilla); cálculo mental (secuencias de tu repertorio, con lectura en voz alta); partida a ciegas contra Stockfish con nivel ajustable, jugadas por texto o voz ("caballo f3") y contador de veces que miraste el tablero.
- **Finales teóricos**: mate con dama y con torre, rey y peón (ganar y defender), Lucena y Philidor, contra la defensa perfecta de las tablas de finales de Lichess, que también juzgan cada jugada.
- **Coach gratis** (pestaña Coach): "Copiar y abrir Claude" arma la pregunta con todos tus datos y la pega en tu cuenta de Claude, sin costo de API. **Conector MCP** en `/api/mcp` (`api/mcp.ts`): lo agregás en Claude → Configuración → Conectores → Agregar conector personalizado, y Claude puede leer tus partidas, ratings e historial de Chess.com (solo lectura, datos públicos).
- **Coach de IA opcional dentro de la app (API paga)**: Claude Opus 5.5 vía una función de Vercel (`api/coach.ts`). La app le manda un resumen de tus datos (partidas, errores de Stockfish con sus líneas, estadísticas) y la instrucción de no inventar jugadas ni variantes. Preguntas rápidas, "Explicamelo" desde cada error e informe semanal.
  - Configuración: `ANTHROPIC_API_KEY` (y opcionalmente `COACH_PASSWORD`) en Vercel → Settings → Environment Variables, y después Redeploy. Costo aproximado: 2 a 5 centavos de dólar por pregunta.
- **Estadísticas** (Inicio → Estadísticas): esta semana vs la anterior, rating de los 3 ritmos, entrenamiento vs resultados por semana, errores por partida analizada, puntaje por ritmo y temas tácticos.
- **Recordatorios**: Ajustes → Recordatorios genera eventos de calendario (`api/reminders.ts`, archivo .ics) con alerta: reto diario, partidas semanales (jueves) y cierre de semana (domingo). Las notificaciones push web en iPhone necesitarían un servidor y una base de datos; el calendario es gratis y confiable.
- **Para probar el coach localmente** hace falta `vercel dev`; con `npm run dev` las funciones `/api` no existen.

## Cómo se cuenta el progreso

- **Solo cuenta lo que hacés bien.** Un ejercicio cuenta para el plan del día si lo resolvés sin pedir la solución. Los reintentos están permitidos.
- Para el **porcentaje de acierto** (estadísticas y prioridades) solo vale el **primer intento sin pista**.
- **Si te equivocás, la app no te muestra la respuesta**: te avisa y podés pensar de nuevo. Si querés, podés pedir una **pista** (marca la pieza que hay que mover) o **ver la solución**, pero entonces no cuenta como resuelto.
- En los finales teóricos podés **deshacer** la jugada que tiró el resultado y pensar otra.
- Las rondas a ciegas cuentan si tienen al menos 70% de acierto; la partida a ciegas cuenta si no la perdés.
- **Historial** (Entrenar → Historial): todo lo que hiciste, separado en *a la primera*, *con reintentos* y *sin resolver*. Tocás cualquier ejercicio para repetirlo.
- **Planes de medio juego** (Entrenar → Planes de medio juego): lecciones sobre tus estructuras (Colle, Francesa, peón aislado, Carlsbad). Las jugadas que se piden están verificadas con Stockfish.

## Créditos

- Ejercicios: base de datos de Lichess (CC0).
- Finales: tablas de finales de Lichess (tablebase.lichess.ovh).
- Coach: Claude (Anthropic).
- Motor: Stockfish (GPL v3), build WebAssembly de nmrugg/stockfish.js.
- Caballo del logo y piezas del tablero: set "cburnett" de Colin M.L. Burnett (licencias BSD/GPL/GFDL).

