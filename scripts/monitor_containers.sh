#!/bin/bash
# ==============================================================================
# Production Self-Healing & Container Monitoring Daemon
# ==============================================================================

LOG_FILE="/var/log/app_monitor.log"
NGINX_CONF="/etc/nginx/sites-available/default"

# 1. Dynamically detect currently active Nginx upstream port (8081 or 8082)
ACTIVE_PORT=$(grep -i "server 127" "$NGINX_CONF" 2>/dev/null | awk -F':' '{print $2}' | tr -d ';' | tr -d ' ')

if [ "$ACTIVE_PORT" == "8081" ]; then
    ACTIVE_CONTAINER="app-blue"
elif [ "$ACTIVE_PORT" == "8082" ]; then
    ACTIVE_CONTAINER="app-green"
else
    echo "[$(date)] [ALERT-CRITICAL] Invalid Nginx port config in $NGINX_CONF!" >> "$LOG_FILE"
    exit 1
fi

# 2. Check Database Health (PostgreSQL)
if ! docker ps --format '{{.Names}}' | grep -q "^production-postgres$"; then
    echo "[$(date)] [ALERT-CRITICAL] PostgreSQL DB container is DOWN! Attempting auto-restart..." >> "$LOG_FILE"
    docker start production-postgres >> "$LOG_FILE" 2>&1
fi

# 3. Check Active App Container HTTP Health Endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:${ACTIVE_PORT}/health" || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    # Healthy - optional quiet log or heartbeat
    echo "[$(date)] [OK] Production active container $ACTIVE_CONTAINER (Port $ACTIVE_PORT) is HEALTHY (HTTP $HTTP_CODE)." >> "$LOG_FILE"
else
    echo "[$(date)] [ALERT-CRITICAL] Container $ACTIVE_CONTAINER failed health check (HTTP $HTTP_CODE)!" >> "$LOG_FILE"
    
    # Auto-Recovery Action: If container stopped, start it
    if ! docker ps --format '{{.Names}}' | grep -q "^${ACTIVE_CONTAINER}$"; then
        echo "[$(date)] [RECOVERY] Container $ACTIVE_CONTAINER was stopped. Executing auto-start..." >> "$LOG_FILE"
        docker start "$ACTIVE_CONTAINER" >> "$LOG_FILE" 2>&1
    else
        # Container is running but returning 500 error: trigger container restart
        echo "[$(date)] [RECOVERY] Container $ACTIVE_CONTAINER is unresponsive. Triggering container restart..." >> "$LOG_FILE"
        docker restart "$ACTIVE_CONTAINER" >> "$LOG_FILE" 2>&1
    fi
fi
