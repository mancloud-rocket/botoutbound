# Rocketbot Outbound Agent

Agente de llamadas outbound usando Twilio ConversationRelay + Rocketbot SaturnStudio con OpenAI Realtime API.

## Configuración Rápida en Replit

### 1. Variables de Entorno Requeridas

Configura estas variables en Replit Secrets:

```
# Servidor
PORT=3001
SERVER=tu-replit-url.replit.app

# OpenAI
OPENAI_API_KEY=tu_openai_api_key

# ElevenLabs (opcional)
USE_ELEVENLABS=true
ELEVENLABS_API_KEY=tu_elevenlabs_api_key
ELEVENLABS_VOICE_ID=tu_voice_id

# Twilio
TWILIO_ACCOUNT_SID=tu_twilio_account_sid
TWILIO_AUTH_TOKEN=tu_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890

# Rocketbot
ROCKETBOT_WEBHOOK_URL=tu_rocketbot_webhook_url

# Transferencias
TRANSFER_NUMBER=+1234567890

# Realtime API
USE_REALTIME_API=true
```

### 2. Endpoints Principales

- `POST /schedule-call` - Programar llamada outbound
- `POST /outbound-voice` - Manejo de voz (webhook de Twilio)
- `POST /call-status` - Status de llamadas
- `WS /outbound-sockets` - WebSocket para ConversationRelay

### 3. Características

- ✅ Optimizado para baja latencia
- ✅ OpenAI Realtime API
- ✅ Soporte ElevenLabs y Google TTS
- ✅ Transferencia de llamadas
- ✅ Cambio de idioma dinámico
- ✅ Integración con Rocketbot SaturnStudio

## Uso

```bash
# Programar una llamada
curl -X POST https://tu-replit-url.replit.app/schedule-call \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "campaignId": "campaign_001"
  }'
```