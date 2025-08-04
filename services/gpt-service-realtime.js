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

      // Manejo mejorado para respuestas con formato markdown de N8N
      let result;
      const responseText = await response.text();
      
      console.log(`📄 [DEBUG] Raw response (first 200 chars): ${responseText.substring(0, 200)}`);
      
      try {
        // Limpiar la respuesta de markdown/backticks antes de parsear
        let cleanedResponse = responseText.trim();
        
        // Remover triple backticks al inicio y final si existen
        if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
          console.log(`🧹 [CLEANUP] Removed markdown backticks`);
        }
        
        // Limpiar caracteres escapados y de nueva línea
        cleanedResponse = cleanedResponse
          .replace(/\\n/g, '')     // Remover \n escapados
          .replace(/\\"/g, '"')    // Convertir \" a "
          .replace(/\\'/g, "'")    // Convertir \' a '
          .replace(/^\n+/, '')     // Remover \n al inicio
          .replace(/\n+$/, '')     // Remover \n al final
          .trim();
        
        console.log(`🧹 [CLEANUP] Cleaned response: ${cleanedResponse.substring(0, 100)}...`);
        
        // Intentar parsear como JSON limpio
        result = JSON.parse(cleanedResponse);
        console.log(`✅ [JSON-SUCCESS] Parsed successfully`);
      } catch (parseError) {
        console.log(`❌ [JSON-ERROR] Parse failed: ${parseError.message}`);
        
        // Intentar extraer JSON válido de dentro del texto
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log(`✅ [JSON-RECOVERY] Extracted valid JSON from raw text`);
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
        // Envío inmediato de respuesta completa sin streaming artificial
        console.log(`🚀 [INSTANT] Sending complete response immediately`);
        this.emit("gptreply", result.response, true, interactionCount);
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

  

  // Método optimizado para interrupciones inmediatas
  interrupt() {
    console.log("🛑 [ULTRA-FAST] Immediate interrupt - canceling all operations");
    this.isProcessing = false;
    if (this.pendingResponse) {
      this.pendingResponse = null;
    }
  }

  
}

module.exports = { GptServiceRealtime };
