# SQL-Werkstatt – schlankes Laufzeit-Image (keine npm-Abhängigkeiten)
FROM node:22-alpine

LABEL org.opencontainers.image.title="SQL-Werkstatt" \
      org.opencontainers.image.description="Interaktive Lernwerkstatt für Datenaufbereitung und SQL" \
      org.opencontainers.image.source="https://github.com/Pyzyi/sqlw" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    APP_VERSION=2.0.0

WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public

RUN mkdir -p /data && chown node:node /data && chmod 0700 /data

# Startet als root nur, um /data (z. B. Bind-Mount unter /DATA/AppData) dem
# Laufzeitbenutzer "node" (UID 1000) zu übergeben – danach gibt der Prozess alle
# Rechte ab. Läuft der Container direkt mit "user: 1000", entfällt dieser Schritt.
EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
