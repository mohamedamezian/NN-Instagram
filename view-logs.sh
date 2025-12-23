#!/bin/bash
# Helper script to view Instagram sync logs

LOGS_DIR="./logs"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ ! -d "$LOGS_DIR" ]; then
  echo -e "${RED}Logs directory not found${NC}"
  exit 1
fi

# Get the most recent log file
LATEST_LOG=$(ls -t "$LOGS_DIR"/instagram-sync-*.json 2>/dev/null | head -n 1)

if [ -z "$LATEST_LOG" ]; then
  echo -e "${YELLOW}No log files found${NC}"
  exit 0
fi

echo -e "${BLUE}=== Latest Instagram Sync Log ===${NC}"
echo -e "${BLUE}File: $(basename "$LATEST_LOG")${NC}\n"

# Parse command argument
case "$1" in
  summary)
    echo -e "${GREEN}Summary:${NC}"
    jq -C '.summary' "$LATEST_LOG"
    ;;
  errors)
    echo -e "${RED}Errors:${NC}"
    jq -C '.operations[] | select(.success == false)' "$LATEST_LOG"
    ;;
  files)
    echo -e "${GREEN}File Operations:${NC}"
    jq -C '.operations[] | select(.operation == "fileCreate" or .operation == "stagedUploadCreate")' "$LATEST_LOG"
    ;;
  metaobjects)
    echo -e "${GREEN}Metaobject Operations:${NC}"
    jq -C '.operations[] | select(.operation | startswith("metaobjectUpsert"))' "$LATEST_LOG"
    ;;
  existing)
    echo -e "${GREEN}Existing Posts Detection:${NC}"
    jq -C '.operations[] | select(.operation == "getExistingPosts")' "$LATEST_LOG"
    ;;
  processing)
    echo -e "${GREEN}Post Processing Decisions:${NC}"
    jq -C '.operations[] | select(.operation == "postProcessing")' "$LATEST_LOG"
    ;;
  all)
    echo -e "${GREEN}Full Log:${NC}"
    jq -C '.' "$LATEST_LOG"
    ;;
  list)
    echo -e "${GREEN}Available log files:${NC}"
    ls -lht "$LOGS_DIR"/instagram-sync-*.json | head -n 10
    ;;
  *)
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  summary      - Show sync summary"
    echo "  errors       - Show only failed operations"
    echo "  files        - Show file upload operations"
    echo "  metaobjects  - Show metaobject create/update operations"
    echo "  existing     - Show existing posts detection"
    echo "  processing   - Show post processing decisions (create vs update)"
    echo "  all          - Show complete log (full JSON)"
    echo "  list         - List available log files"
    echo ""
    echo "Examples:"
    echo "  $0 summary"
    echo "  $0 errors | less"
    echo "  $0 metaobjects | jq '.userErrors'"
    ;;
esac
