require('colors');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class GptServiceRealtime extends EventEmitter {
  constructor() {
    super();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://studio.rocketbot.com/webhook/e9e0142a7bdadfd9f3fbc32ac7cb2d77';
    this.userContext = [];
    this.lastContextCache = ''; // Cache para evitar reconstruir contexto

    if (!this.n8nWebhookUrl) {
      console.error('❌ [ERROR] N8N_WEBHOOK_URL is not configured!');
      console.error('💡 Please set N8N_WEBHOOK_URL in your .env file');
    }

    console.log(`🚀 [ULTRA-LOW-LATENCY] GptServiceRealtime optimized for maximum speed: ${this.n8nWebhookUrl}`);
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    const startTime = Date.now();
    console.log('⚡ [ULTRA-FAST] Starting completion:', text.substring(0, 50));

    this.updateUserContext(name, role, text);

    // Validate webhook URL
    if (!this.n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL is not configured');
    }

    // Intento principal con retry automático
    return this.attemptRequest(text, interactionCount, startTime, 0);
  }

  async attemptRequest(text, interactionCount, startTime, attempt) {
    try {
      // Payload ultra-minimalista para máxima velocidad
      const ultraPayload = {
        m: text, // message ultra-comprimido
        c: interactionCount, // count comprimido
        r: true // realtime flag
      };

      console.log('📤 [ULTRA-FAST] Sending minimal payload');

      // Request con timeout ultra-agresivo y retry
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout ultra-agresivo

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Accept': 'application/json'
        },
        body: JSON.stringify(ultraPayload),
        signal: controller.signal,
        keepalive: true,
        compress: true // Compresión habilitada
      });

      clearTimeout(timeoutId);

      const requestTime = Date.now() - startTime;
      console.log(`⚡ [ULTRA-FAST] Request completed in ${requestTime}ms (attempt ${attempt + 1})`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Parse response ultra-rápido
      const result = await response.json();

      const totalTime = Date.now() - startTime;
      console.log(`🚀 [ULTRA-FAST] Total time: ${totalTime}ms`);

      // Manejo optimizado de respuesta
      if (result.response && result.response.trim()) {
        // Streaming instantáneo sin delays
        await this.instantStreaming(result.response, interactionCount);
        this.userContext.push({'role': 'assistant', 'content': result.response});
      } else {
        throw new Error('Empty response');
      }

    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`❌ [ULTRA-FAST] Error after ${errorTime}ms (attempt ${attempt + 1}):`, error.message);

      // Retry automático una sola vez para no perder más tiempo
      if (attempt === 0 && errorTime < 4000) {
        console.log('🔄 [ULTRA-FAST] Quick retry...');
        return this.attemptRequest(text, interactionCount, startTime, attempt + 1);
      }

      // Respuesta de error inmediata
      this.emit('gptreply', 'Disculpa, no pude procesar tu solicitud.', true, interactionCount);
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }

    // Mantener solo últimos 5 mensajes para máxima velocidad
    if (this.userContext.length > 5) {
      this.userContext = this.userContext.slice(-5);
    }

    // Cache del contexto para evitar reconstruirlo
    this.lastContextCache = this.userContext.slice(-2).map(ctx => `${ctx.role}:${ctx.content.substring(0, 100)}`).join('|');
  }

  setCallInfo(info, value) {
    console.log('setCallInfo', info, value);
    this.userContext.push({ 'role': 'user', 'content': `${info}: ${value}` });
  }

  interrupt() {
    // Handle interruption for realtime
    console.log('Interrupt received in realtime mode');
  }

  async instantStreaming(fullResponse, interactionCount) {
    // Streaming ultra-rápido - chunks más grandes, menos delays
    const words = fullResponse.split(' ');
    let partialResponse = '';

    for (let i = 0; i < words.length; i++) {
      partialResponse += words[i] + ' ';

      // Chunks de 10-12 palabras para máxima fluidez
      if (i % 10 === 0 || i === words.length - 1) {
        const isLast = i === words.length - 1;
        this.emit('gptreply', partialResponse.trim(), isLast, interactionCount);
        partialResponse = '';

        // Delay mínimo para no saturar pero mantener fluidez
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 25)); // 25ms ultra-rápido
        }
      }
    }
  }
}

module.exports = { GptServiceRealtime };