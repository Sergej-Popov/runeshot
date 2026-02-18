# Runeshot LAN Docker Deployment

This repo ships two containers in one compose stack:
- `server`: Colyseus websocket server on port `2567`
- `client`: static web client on port `8080`

## Start

```bash
docker compose up -d --build
```

## Access from LAN

- Open `http://<linux-server-ip>:8080` in browser.
- By default client connects to `ws://<same-hostname>:2567`.

## Override server address and port from client

You can set websocket endpoint at runtime with either:

1. Query string:
```text
http://<linux-server-ip>:8080/?server=192.168.1.50:2567
```
or
```text
http://<linux-server-ip>:8080/?server=ws://192.168.1.50:2567
```

2. Container environment variable (no rebuild needed):
- Set `RUNESHOT_SERVER_URL` for `client` service in `docker-compose.yml`, for example:
```yaml
RUNESHOT_SERVER_URL: "ws://192.168.1.50:2567"
```

Query string wins over env and is persisted in browser local storage (`runeshot.serverUrl`).
