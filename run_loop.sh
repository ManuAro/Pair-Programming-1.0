#!/bin/bash
#
# Pair-Programming Autónomo: Claude Code + Codex
# Loop infinito con árbitro integrado
#

set -e

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
WORKSPACE_DIR="$SCRIPT_DIR/workspace"

PROMPT_FILE="$CONFIG_DIR/PROMPT_INICIAL.md"
CONVERSACION_FILE="$WORKSPACE_DIR/CONVERSACION.md"

# Configuración del árbitro
ARBITRO_CADA_N_TURNOS=6  # Checkpoint fijo cada N turnos

# Delay entre turnos (segundos)
DELAY=5

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🌍 PAIR-PROGRAMMING AUTÓNOMO: CLAUDE + CODEX 🌍           ║"
echo "║                                                              ║"
echo "║   Objetivo: Cambiar el mundo                                 ║"
echo "║   Modo: Loop infinito con árbitro                            ║"
echo "║                                                              ║"
echo "║   Presiona Ctrl+C para detener                               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar comandos
if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ ERROR: 'claude' no está instalado${NC}"
    exit 1
fi

if ! command -v codex &> /dev/null; then
    echo -e "${RED}❌ ERROR: 'codex' no está instalado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Claude Code detectado${NC}"
echo -e "${GREEN}✅ Codex detectado${NC}"
echo -e "${GREEN}✅ Árbitro activado (cada $ARBITRO_CADA_N_TURNOS turnos + detección de problemas)${NC}"

# Crear directorios
mkdir -p "$WORKSPACE_DIR/src"

# Obtener número de turno
get_turn_number() {
    if [ -f "$CONVERSACION_FILE" ]; then
        grep -oE "Turno #[0-9]+" "$CONVERSACION_FILE" | tail -1 | grep -oE "[0-9]+" || echo "0"
    else
        echo "0"
    fi
}

# Cargar prompt base
PROMPT_BASE=$(cat "$PROMPT_FILE")

# Prompt del árbitro
ARBITRO_PROMPT='Eres el ÁRBITRO del pair-programming entre Claude y Codex.

Tu rol es evaluar si la conversación va por buen camino.

ANALIZA LA CONVERSACIÓN Y RESPONDE CON UNA DE ESTAS ACCIONES:

**ACCIÓN 1 - CONTINUAR** (si todo va bien):
```
VEREDICTO: CONTINUAR
Razón: [1 línea explicando por qué van bien]
```

**ACCIÓN 2 - REDIRIGIR** (si hay problemas):
```
VEREDICTO: REDIRIGIR
Problema detectado: [qué está mal]
Instrucción para los agentes: [qué deben hacer diferente]
```

SEÑALES DE PROBLEMAS:
- Están repitiendo ideas sin avanzar
- Se desviaron de la estructura de fases
- Están siendo demasiado abstractos sin concretar
- Cayeron en algo prohibido (chatbot, marketplace, etc.)
- Llevan muchos turnos sin elegir un problema
- Están de acuerdo demasiado fácil (sin destrucción real)
- El código no funciona o está incompleto

SEÑALES DE QUE VAN BIEN:
- Siguen la estructura de fases
- Las críticas son sustanciales
- Hay progreso concreto turno a turno
- El código funciona
- Las ideas son ambiciosas pero factibles

Sé breve y directo. No más de 5 líneas total.'

# Construir prompt para turno normal
build_prompt() {
    local AI_NAME=$1
    local TURN_NUMBER=$2

    cat <<EOF
$PROMPT_BASE

---

## INSTRUCCIONES PARA ESTE TURNO

Eres **$AI_NAME** en este pair-programming.
**Tu turno: #$TURN_NUMBER**

IMPORTANTE - GESTIÓN DE CONTEXTO:
- Lee workspace/CONVERSACION.md para ver el historial
- Usa "intentional compaction": resume mentalmente antes de responder
- Incluye "### Contexto compactado" con 2-3 líneas del estado actual

INSTRUCCIONES:
1. Lee workspace/CONVERSACION.md
2. Analiza el último turno de tu compañero
3. Responde siguiendo el formato especificado
4. ESCRIBE tu respuesta al final de workspace/CONVERSACION.md
5. Si escribes código, guárdalo en workspace/src/

NO esperes confirmación. Ejecuta tu turno completamente.
EOF
}

# Ejecutar turno de Claude
run_claude_turn() {
    local TURN_NUMBER=$1
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}🔄 TURNO #$TURN_NUMBER - CLAUDE${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

    local PROMPT=$(build_prompt "Claude" "$TURN_NUMBER")

    cd "$SCRIPT_DIR"
    claude -p "$PROMPT" --dangerously-skip-permissions --model claude-sonnet-4-5-20250929

    echo -e "${GREEN}✅ Claude completó su turno${NC}"
}

# Ejecutar turno de Codex
run_codex_turn() {
    local TURN_NUMBER=$1
    echo -e "\n${YELLOW}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}🔄 TURNO #$TURN_NUMBER - CODEX${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"

    local PROMPT=$(build_prompt "Codex" "$TURN_NUMBER")

    cd "$SCRIPT_DIR"
    codex exec "$PROMPT" --full-auto

    echo -e "${GREEN}✅ Codex completó su turno${NC}"
}

# Ejecutar árbitro
run_arbitro() {
    local TURN_NUMBER=$1
    local REASON=$2  # "checkpoint" o "detección"

    echo -e "\n${MAGENTA}════════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}⚖️  ÁRBITRO - Evaluación ($REASON) después del turno #$TURN_NUMBER${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════${NC}"

    local CONVERSACION=$(cat "$CONVERSACION_FILE")

    local PROMPT="$ARBITRO_PROMPT

---

CONVERSACIÓN A EVALUAR:
$CONVERSACION"

    # Usar Claude como árbitro (más analítico)
    cd "$SCRIPT_DIR"
    local VEREDICTO=$(claude -p "$PROMPT" --dangerously-skip-permissions --model claude-haiku-4-5-20251001 2>&1)

    echo -e "${MAGENTA}$VEREDICTO${NC}"

    # Si hay redirección, agregarlo a la conversación
    if echo "$VEREDICTO" | grep -q "REDIRIGIR"; then
        echo -e "\n${RED}⚠️  Árbitro detectó problemas - agregando instrucción a la conversación${NC}"

        cat >> "$CONVERSACION_FILE" <<EOF

---

## ⚖️ INTERVENCIÓN DEL ÁRBITRO (Turno #$TURN_NUMBER)

$VEREDICTO

**Los agentes deben ajustar su siguiente turno según esta instrucción.**

---

EOF
    fi

    echo -e "${GREEN}✅ Árbitro completó evaluación${NC}"
}

# Detectar si hay problemas (heurísticas simples)
detectar_problemas() {
    if [ ! -f "$CONVERSACION_FILE" ]; then
        return 1  # No hay problemas si no hay archivo
    fi

    local CONTENIDO=$(cat "$CONVERSACION_FILE")
    local ULTIMOS_TURNOS=$(echo "$CONTENIDO" | tail -100)

    # Detectar repetición excesiva de frases
    local REPETICIONES=$(echo "$ULTIMOS_TURNOS" | grep -c "estoy de acuerdo" || true)
    if [ "$REPETICIONES" -gt 3 ]; then
        echo "Demasiado acuerdo sin fricción"
        return 0
    fi

    # Detectar si mencionan cosas prohibidas
    if echo "$ULTIMOS_TURNOS" | grep -qi "chatbot\|marketplace\|dashboard\|plataforma que conecta"; then
        echo "Mencionaron algo prohibido"
        return 0
    fi

    # Detectar estancamiento SOLO si no están progresando en convencimiento
    # (Es válido estar muchos turnos en Fase 1 si están iterando y el % de convencimiento cambia)
    local TURNOS_RECIENTES=$(echo "$CONTENIDO" | grep -c "## \(Claude\|Codex\) - Turno" || true)
    if [ "$TURNOS_RECIENTES" -gt 12 ]; then
        # Solo alertar si NO hay progreso en convencimiento (no mencionan %)
        if ! echo "$ULTIMOS_TURNOS" | grep -qi "CONVENCIMIENTO\|[0-9]\+%\|FASE 2\|100%"; then
            echo "Llevan muchos turnos sin evaluar convencimiento"
            return 0
        fi
    fi

    return 1  # No hay problemas
}

# Loop principal
TURN=$(get_turn_number)
echo -e "${GREEN}📊 Último turno registrado: #$TURN${NC}"

TURN_COUNT=0

trap 'echo -e "\n\n${RED}🛑 Loop detenido manualmente${NC}"; echo -e "${GREEN}Turnos completados: $TURN_COUNT${NC}"; exit 0' INT

while true; do
    TURN=$((TURN + 1))

    # Alternar: Claude en impares, Codex en pares
    if [ $((TURN % 2)) -eq 1 ]; then
        run_claude_turn $TURN
    else
        run_codex_turn $TURN
    fi

    TURN_COUNT=$((TURN_COUNT + 1))

    # Árbitro: checkpoint cada N turnos
    if [ $((TURN % ARBITRO_CADA_N_TURNOS)) -eq 0 ]; then
        run_arbitro $TURN "checkpoint programado"
    else
        # Árbitro: detección de problemas entre checkpoints
        PROBLEMA=$(detectar_problemas) && run_arbitro $TURN "detección: $PROBLEMA"
    fi

    echo -e "\n${BLUE}⏳ Esperando $DELAY segundos...${NC}"
    sleep $DELAY
done
