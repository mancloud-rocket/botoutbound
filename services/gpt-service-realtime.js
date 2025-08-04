require("colors");
const EventEmitter = require("events");
const fetch = require("node-fetch");

class GptServiceRealtime extends EventEmitter {
  constructor() {
    super();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.n8nWebhookUrl =
      process.env.N8N_WEBHOOK_URL ||
      "https://studio.rocketbot.com/webhook/e9e0142a7bdadfd9f3fbc32ac7cb2d77";
    this.userContext = [];
    
    // Optimización para detección rápida de fin de habla
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.pendingResponse = null;
    
    // Configuración de streaming ultra rápido
    this.fastStreamingConfig = {
      wordsPerChunk: 3, // Menos palabras por chunk para respuesta más rápida
      chunkDelay: 25,   // Delay mínimo entre chunks (25ms)
      minChunkSize: 1   // Tamaño mínimo de chunk
    };

    if (!this.n8nWebhookUrl) {
      console.error("❌ [ERROR] N8N_WEBHOOK_URL is not configured!");
      console.error("💡 Please set N8N_WEBHOOK_URL in your .env file");
    }

    console.log(
      `🚀 [ULTRA-FAST] GptServiceRealtime optimizado para máxima velocidad: ${this.n8nWebhookUrl}`,
    );
  }

  async completion(text, interactionCount, role = "user", name = "user") {
    const startTime = Date.now();
    
    // Cancelar request anterior si está en proceso (optimización de velocidad)
    if (this.isProcessing && this.pendingResponse) {
      console.log("🔄 [ULTRA-FAST] Canceling previous request for immediate response");
      this.pendingResponse = null;
    }
    
    this.isProcessing = true;
    this.lastRequestTime = startTime;
    
    console.log(`🚀 [ULTRA-FAST] Immediate completion start: ${text.substring(0, 50)}...`);

    this.updateUserContext(name, role, text);

    if (!this.n8nWebhookUrl) {
      throw new Error("N8N_WEBHOOK_URL is not configured");
    }

    try {
      // Payload ultra optimizado - solo lo esencial
      const ultraMinimalPayload = {
        msg: text,
        ctx: this.userContext.slice(-2).map(c => `${c.role}:${c.content.substring(0, 100)}`).join("|"),
        cnt: interactionCount,
        rt: 1
      };

      console.log(`📤 [ULTRA-FAST] Minimal payload (${JSON.stringify(ultraMinimalPayload).length} bytes)`);

      // Request con configuración de máxima velocidad
      const requestPromise = fetch(this.n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "keep-alive",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(ultraMinimalPayload),
        timeout: 10000,
        agent: false, // Disable connection pooling for immediate response
        highWaterMark: 0 // Immediate streaming
      });

      this.pendingResponse = requestPromise;
      const response = await requestPromise;

      const requestTime = Date.now() - startTime;
      console.log(`⚡ [ULTRA-FAST] Network response: ${requestTime}ms`);

      if (!response.ok) {
        throw new Error(`N8N error: ${response.status}`);
      }

      // Mejorar el manejo de respuestas JSON malformadas
      let result;
      const responseText = await response.text();
      
      console.log(`📄 [DEBUG] Raw response (first 200 chars): ${responseText.substring(0, 200)}`);
      
      try {
        // Intentar parsear como JSON
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.log(`❌ [JSON-ERROR] Parse failed: ${parseError.message}`);
        
        // Intentar extraer JSON válido si hay interpolación de variables malformada
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log(`✅ [JSON-RECOVERY] Extracted valid JSON`);
          } catch (extractError) {
            console.log(`❌ [JSON-RECOVERY] Extraction failed: ${extractError.message}`);
            // Usar respuesta de fallback
            result = { response: "Disculpa, hay un problema técnico temporal. ¿Puedes repetir tu pregunta?" };
          }
        } else {
          // Si no se puede extraer JSON, usar el texto como respuesta
          result = { response: responseText.length > 0 ? responseText : "Lo siento, hubo un error de comunicación." };
        }
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`🎯 [ULTRA-FAST] Total: ${totalTime}ms | Response: ${result.response ? 'OK' : 'EMPTY'}`);

      if (result.response) {
        // Streaming inmediato con chunks mínimos
        await this.ultraFastStreaming(result.response, interactionCount);
        this.userContext.push({ role: "assistant", content: result.response });
      } else {
        throw new Error("No response content found");
      }
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`❌ [ULTRA-FAST] Error ${errorTime}ms:`, error.message);
      
      // Log adicional para debug
      if (error.message.includes('invalid json')) {
        console.error(`🔍 [DEBUG] JSON Error details: N8N webhook might be returning malformed JSON`);
        console.error(`🔍 [DEBUG] Check N8N webhook configuration for variable interpolation issues`);
      }
      
      this.emit("gptreply", "Disculpa, hay un problema técnico con el servidor. Por favor, intenta reformular tu pregunta.", true, interactionCount);
    } finally {
      this.isProcessing = false;
      this.pendingResponse = null;
    }
  }

  updateUserContext(name, role, text) {
    if (name !== "user") {
      this.userContext.push({ role: role, name: name, content: text });
    } else {
      this.userContext.push({ role: role, content: text });
    }

    // Keep only last 10 messages to reduce memory
    if (this.userContext.length > 10) {
      this.userContext = this.userContext.slice(-10);
    }
  }

  setCallInfo(info, value) {
    console.log("setCallInfo", info, value);
    this.userContext.push({ role: "user", content: `${info}: ${value}` });
  }

  interrupt() {
    // Handle interruption for realtime
    console.log("Interrupt received in realtime mode");
  }

  async ultraFastStreaming(fullResponse, interactionCount) {
    const words = fullResponse.split(" ");
    let partialResponse = "";
    const { wordsPerChunk, chunkDelay, minChunkSize } = this.fastStreamingConfig;

    // Enviar primer chunk inmediatamente
    if (words.length > 0) {
      this.emit("gptreply", words[0], false, interactionCount);
      
      for (let i = 1; i < words.length; i++) {
        partialResponse += words[i] + " ";

        // Chunks más pequeños y frecuentes para máxima velocidad
        if (i % wordsPerChunk === 0 || i === words.length - 1) {
          const isLast = i === words.length - 1;
          this.emit("gptreply", partialResponse.trim(), isLast, interactionCount);
          partialResponse = "";

          // Delay mínimo solo si no es el último chunk
          if (!isLast) {
            await new Promise((resolve) => setTimeout(resolve, chunkDelay));
          }
        }
      }
    }
  }

  // Método optimizado para interrupciones inmediatas
  interrupt() {
    console.log("🛑 [ULTRA-FAST] Immediate interrupt - canceling all operations");
    this.isProcessing = false;
    if (this.pendingResponse) {
      this.pendingResponse = null;
    }
  }

  // Método para ajustar velocidad de streaming dinámicamente
  setStreamingSpeed(speed = 'ultra-fast') {
    switch(speed) {
      case 'ultra-fast':
        this.fastStreamingConfig = { wordsPerChunk: 2, chunkDelay: 20, minChunkSize: 1 };
        break;
      case 'fast':
        this.fastStreamingConfig = { wordsPerChunk: 3, chunkDelay: 35, minChunkSize: 1 };
        break;
      case 'normal':
        this.fastStreamingConfig = { wordsPerChunk: 5, chunkDelay: 50, minChunkSize: 2 };
        break;
    }
    console.log(`🎛️ [STREAMING] Speed set to: ${speed}`, this.fastStreamingConfig);
  }
}

module.exports = { GptServiceRealtime };
