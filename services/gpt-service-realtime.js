require("colors");
const EventEmitter = require("events");
const fetch = require("node-fetch");

class GptServiceRealtime extends EventEmitter {
  constructor() {
    super();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.n8nWebhookUrl =
      process.env.N8N_WEBHOOK_URL ||
      "https://studio.rocketbot.com/webhook/7dd0066135d7fbdae8c859bac14bd470";
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
      // Payload con historia completa de la conversación
      const fullConversationPayload = {
        msg: text,
        ctx: this.userContext.map(c => `${c.role}:${c.content}`).join("|"),
        cnt: interactionCount,
        rt: 1,
        lang: "es-ES",
        fullHistory: true
      };

      console.log(`📤 [FULL-HISTORY] Full conversation payload (${JSON.stringify(fullConversationPayload).length} bytes)`);
      console.log(`📤 [FULL-HISTORY] Context length: ${this.userContext.length} messages`);
      console.log(`📤 [FULL-HISTORY] Full context being sent:`, this.userContext.map(c => `${c.role}: ${c.content.substring(0, 100)}...`));

      // Request con configuración de máxima velocidad
      const requestPromise = fetch(this.n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "keep-alive",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(fullConversationPayload),
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
      
      console.log(`📄 [DEBUG] Raw response (COMPLETE): ${responseText}`);
      
      try {
        // Limpiar la respuesta de markdown/backticks antes de parsear
        let cleanedResponse = responseText.trim();
        
        // Remover triple backticks al inicio y final si existen
        if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
          console.log(`🧹 [CLEANUP] Removed markdown backticks`);
        }
        
        // Buscar el primer JSON válido en la respuesta
        const jsonStart = cleanedResponse.indexOf('{');
        if (jsonStart !== -1) {
          // Encontrar el final del JSON (última llave de cierre)
          let braceCount = 0;
          let jsonEnd = -1;
          
          for (let i = jsonStart; i < cleanedResponse.length; i++) {
            if (cleanedResponse[i] === '{') braceCount++;
            if (cleanedResponse[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          if (jsonEnd !== -1) {
            const jsonOnly = cleanedResponse.substring(jsonStart, jsonEnd);
            console.log(`🧹 [CLEANUP] Extracted JSON only: ${jsonOnly}`);
            
            // Limpiar caracteres escapados y de nueva línea
            const finalJson = jsonOnly
              .replace(/\\n/g, '')     // Remover \n escapados
              .replace(/\\"/g, '"')    // Convertir \" a "
              .replace(/\\'/g, "'")    // Convertir \' a '
              .replace(/^\n+/, '')     // Remover \n al inicio
              .replace(/\n+$/, '')     // Remover \n al final
              .trim();
            
            console.log(`🧹 [CLEANUP] Final cleaned JSON: ${finalJson}`);
            
            // Intentar parsear como JSON limpio
            result = JSON.parse(finalJson);
            console.log(`✅ [JSON-SUCCESS] Parsed successfully`);
          } else {
            throw new Error("Could not find complete JSON structure");
          }
        } else {
          throw new Error("No JSON structure found in response");
        }
      } catch (parseError) {
        console.log(`❌ [JSON-ERROR] Parse failed: ${parseError.message}`);
        
        // Intentar extraer JSON válido de dentro del texto usando regex más robusto
        const jsonMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s);
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
        // Check if we should end the call (confirmed "yes" OR closing "yes")
        const shouldEndCall = (result.confirmed === "yes" || result.closing === "yes") || 
                             (typeof result === 'object' && (result.confirmed === "yes" || result.closing === "yes"));
        
        if (shouldEndCall) {
          const isConfirmed = result.confirmed === "yes";
          const reason = isConfirmed ? 'Summit attendance confirmed' : 'Summit attendance declined - closing';
          
          console.log(`🎉 ${isConfirmed ? 'CONFIRMED' : 'DECLINED'} Summit attendance! Ending call immediately...`);
          
          // Send the response first
          console.log(`🚀 [INSTANT] Sending final response`);
          console.log(`📝 [FINAL RESPONSE] Complete response:`, result.response);
          this.emit("gptreply", result.response, true, interactionCount);
          this.userContext.push({ role: "assistant", content: result.response });
          
          // Emit endCall event immediately after message
          this.emit('endCall', {
            reason: reason,
            confirmed: isConfirmed,
            timestamp: new Date().toISOString()
          });
          
          return; // Exit early to prevent further processing
        }
        
        // Normal processing for other responses
        console.log(`🚀 [INSTANT] Sending complete response immediately`);
        console.log(`📝 [FULL RESPONSE] Complete response:`, result.response);
        console.log(`📏 [RESPONSE LENGTH] Response length: ${result.response.length} characters`);
        
        // Log confirmation status if present
        if (result.confirmed) {
          console.log('Confirmation status:', result.confirmed);
        }
        if (result.closing) {
          console.log('Closing status:', result.closing);
        }
        
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

    // Mantener toda la historia de la conversación (hasta 50 mensajes para evitar límites)
    if (this.userContext.length > 50) {
      console.log(`📝 [FULL-HISTORY] Trimming context from ${this.userContext.length} to 50 messages`);
      // Mantener los primeros 10 (sistema) y los últimos 40 (conversación)
      const systemMessages = this.userContext.slice(0, 10);
      const recentMessages = this.userContext.slice(-40);
      this.userContext = [...systemMessages, ...recentMessages];
    }
    
    console.log(`📝 [FULL-HISTORY] Context updated: ${this.userContext.length} messages total`);
  }

  setCallInfo(info, value) {
    console.log("setCallInfo", info, value);
    this.userContext.push({ role: "user", content: `${info}: ${value}` });
  }

  interrupt() {
    // Interruptions disabled for outbound calls to ensure complete message delivery
    console.log("🚫 [ULTRA-FAST] Interrupt ignored - maintaining message flow for outbound calls");
    // Do not cancel operations or set isProcessing to false
    // Do not clear pendingResponse
    return;
  }

  
}

module.exports = { GptServiceRealtime };
