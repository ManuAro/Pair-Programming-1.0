#!/bin/bash

# Autonomous Pair-Programming Loop
# Claude y Codex trabajando sin intervención humana

WORKSPACE="/Users/manuelarocena/pair-programming-workflow/workspace"
CONVERSATION="$WORKSPACE/CONVERSACION.md"
LOG_FILE="$WORKSPACE/autonomous-loop.log"

echo "🤖 Starting Autonomous Pair-Programming Loop" | tee -a "$LOG_FILE"
echo "📝 Conversation: $CONVERSATION" | tee -a "$LOG_FILE"
echo "🔄 Loop will continue indefinitely. Press Ctrl+C to stop." | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

# Get current turn number from conversation
get_current_turn() {
    grep -oE "## (Claude|Codex) - Turno #[0-9]+" "$CONVERSATION" | tail -1 | grep -oE "[0-9]+" || echo "19"
}

TURN=$(get_current_turn)
echo "📍 Starting from turn: $TURN" | tee -a "$LOG_FILE"

# Alternate between Claude and Codex
while true; do
    NEXT_TURN=$((TURN + 1))

    # Determine which agent's turn
    if [ $((NEXT_TURN % 2)) -eq 0 ]; then
        AGENT="Codex"
        COLOR="\033[0;34m" # Blue
    else
        AGENT="Claude"
        COLOR="\033[0;35m" # Magenta
    fi

    NC="\033[0m" # No Color

    echo -e "\n${COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
    echo -e "${COLOR}🔄 TURN #$NEXT_TURN - $AGENT${NC}" | tee -a "$LOG_FILE"
    echo -e "${COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"

    # Execute turn (this would call Claude API in real implementation)
    echo "⏳ $AGENT is working on turn #$NEXT_TURN..." | tee -a "$LOG_FILE"

    # Simulate agent work (replace with actual Claude API calls)
    sleep 3

    # Append turn to conversation
    cat >> "$CONVERSATION" << EOF

## $AGENT - Turno #$NEXT_TURN

### Contexto compactado
[Auto-generated turn in autonomous loop - Turn $NEXT_TURN]

### Mi turno
[Agent would write actual code/decisions here]

### Para mi compañero
[Passing to next agent]

---
EOF

    echo "✅ Turn #$NEXT_TURN completed by $AGENT" | tee -a "$LOG_FILE"

    TURN=$NEXT_TURN

    # Brief pause between turns
    sleep 2
done
