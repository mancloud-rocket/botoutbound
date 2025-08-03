
require('colors');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class GptServiceRealtime extends EventEmitter {
  constructor() {
    super();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://studio.rocketbot.com/webhook/e9e0142a7bdadfd9f3fbc32ac7cb2d77';
    this.userContext = [];
    
    if (!this.n8nWebhookUrl) {
      console.error('❌ [ERROR] N8N_WEBHOOK_URL is not configured!');
      console.error('💡 Please set N8N_WEBHOOK_URL in your .env file');
    }
    
    console.log(`🚀 [REALTIME] GptServiceRealtime initialized with webhook: ${this.n8nWebhookUrl}`);
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    const startTime = Date.now();
    console.log('🚀 [REALTIME] Starting completion:', role, name, text);
    
    this.updateUserContext(name, role, text);

    // Validate webhook URL
    if (!this.n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL is not configured');
    }

    try {
      const payload = {
        currentMessage: text,
        conversationHistory: this.userContext,
        interactionCount: interactionCount,
        realtime: true,
        timestamp: Date.now()
      };

      console.log('📤 [REALTIME] Sending payload to N8N');

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      const requestTime = Date.now() - startTime;
      console.log(`⏱️ [REALTIME] Request completed in ${requestTime}ms`);

      if (!response.ok) {
        throw new Error(`N8N webhook error: ${response.status}`);
      }

      const result = await response.json();
      
      const totalTime = Date.now() - startTime;
      console.log(`⚡ [REALTIME] Total response time: ${totalTime}ms`);
      console.log('🔍 [REALTIME] Response:', result);
      
      if (result.response) {
        await this.streamResponse(result.response, interactionCount);
        this.userContext.push({'role': 'assistant', 'content': result.response});
      } else {
        throw new Error('No response content found');
      }

    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`❌ [REALTIME] Error after ${errorTime}ms:`, error);
      this.emit('gptreply', 'Lo siento, hubo un error procesando tu solicitud.', true, interactionCount);
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
    
    // Keep only last 10 messages to reduce memory
    if (this.userContext.length > 10) {
      this.userContext = this.userContext.slice(-10);
    }
  }

  setCallInfo(info, value) {
    console.log('setCallInfo', info, value);
    this.userContext.push({ 'role': 'user', 'content': `${info}: ${value}` });
  }

  interrupt() {
    console.log('Interrupt received in realtime mode');
  }

  async streamResponse(fullResponse, interactionCount) {
    const words = fullResponse.split(' ');
    let partialResponse = '';
    
    for (let i = 0; i < words.length; i++) {
      partialResponse += words[i] + ' ';
      
      if (i % 8 === 0 || i === words.length - 1) {
        const isLast = i === words.length - 1;
        this.emit('gptreply', partialResponse.trim(), isLast, interactionCount);
        partialResponse = '';
        
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }
}

module.exports = { GptServiceRealtime };
