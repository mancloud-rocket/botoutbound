require("dotenv").config({ path: './.env' });
require("colors");
require("log-timestamp");

// Debugging de variables de entorno
console.log("=== DEBUGGING ENV VARIABLES ===");
console.log("TWILIO_FROM_NUMBER:", process.env.TWILIO_FROM_NUMBER);
console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "SET" : "NOT SET");
console.log("================================");

const express = require("express");
const ExpressWs = require("express-ws");

const { GptService } = require("./services/gpt-service");
const { GptServiceRealtime } = require("./services/gpt-service-realtime");
const { TextService } = require("./services/text-service");
const { recordingService } = require("./services/recording-service");

const { prompt } = require("./services/prompt");
const voiceConfig = require("./config/voice-config");

const app = express();
ExpressWs(app);

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

// Declare global variable
let gptService;
let textService;
let record;

// Function to select GPT service based on environment variable
function createGptService(model) {
  const useRealtime = process.env.USE_REALTIME_API === "true";

  if (useRealtime) {
    console.log("🚀 [SERVICE] Using N8N Realtime API (Optimized)".green);
    addLog("info", "🚀 [SERVICE] Using N8N Realtime API (Optimized)");
    return new GptServiceRealtime();
  } else {
    console.log("📡 [SERVICE] Using N8N Standard Service".blue);
    addLog("info", "📡 [SERVICE] Using N8N Standard Service");
    return new GptService(model);
  }
}
// Add this code after creating the Express app

app.get("/monitor", (req, res) => {
  res.sendFile(__dirname + "/monitor.html");
});

// Initialize an array to store logs
const logs = [];

// Method to add logs
function addLog(level, message) {
  console.log(message);
  const timestamp = new Date().toISOString();
  logs.push({ timestamp, level, message });
}

// Helper function to parse WebSocket messages robustly
function parseWebSocketMessage(data) {
  try {
    let cleanData = data.toString();
    
    // DEBUG: Mostrar datos raw completos
    console.log("🔍 [DEBUG] RAW DATA (length:", cleanData.length, "):", cleanData);
    console.log("🔍 [DEBUG] RAW DATA (hex):", Buffer.from(cleanData).toString('hex'));
    
    // Mejorar el parser para manejar diferentes formatos
    if (cleanData.startsWith('json')) {
      cleanData = cleanData.substring(4); // Remover "json"
      console.log("🔍 [DEBUG] Removed 'json' prefix");
    } else if (cleanData.startsWith('json{')) {
      cleanData = cleanData.substring(4); // Remover "json" del inicio
      console.log("🔍 [DEBUG] Removed 'json{' prefix");
    }
    
    // Limpiar espacios en blanco al inicio y final
    cleanData = cleanData.trim();
    console.log("🔍 [DEBUG] CLEANED DATA (length:", cleanData.length, "):", cleanData);
    
    // Verificar que el JSON sea válido
    if (!cleanData.startsWith('{') && !cleanData.startsWith('[')) {
      console.error("❌ [JSON-ERROR] Invalid JSON format - doesn't start with { or [");
      console.error("❌ [JSON-ERROR] First 50 chars:", cleanData.substring(0, 50));
      console.error("❌ [JSON-ERROR] First char code:", cleanData.charCodeAt(0));
      return null;
    }
    
    const parsed = JSON.parse(cleanData);
    console.log("✅ [DEBUG] Successfully parsed JSON:", parsed);
    return parsed;
    
  } catch (error) {
    console.error("❌ [JSON-ERROR] Parse failed:", error.message);
    console.error("❌ [JSON-ERROR] Raw data (full):", data.toString());
    console.error("❌ [JSON-ERROR] Cleaned data (full):", cleanData);
    console.error("❌ [JSON-ERROR] Error stack:", error.stack);
    return null;
  }
}

// Route to retrieve logs
app.get("/logs", (req, res) => {
  res.json(logs);
});

// Endpoint eliminado - solo usamos llamadas outbound

// Nueva ruta para recibir respuestas simples de RocketBot
app.post("/simple-response", async (req, res) => {
  try {
    addLog("info", "Received simple response from RocketBot");

    // Obtener el string de respuesta del body con múltiples fallbacks
    let responseText = "No se recibió respuesta";

    // Intentar diferentes formas de obtener la respuesta
    if (req.body && typeof req.body === "object") {
      responseText =
        req.body.response ||
        req.body.text ||
        req.body.message ||
        req.body.content ||
        "No se recibió respuesta";
    } else if (typeof req.body === "string") {
      responseText = req.body;
    }

    // Limpiar y validar la respuesta
    responseText = responseText.toString().trim();
    if (!responseText || responseText === "No se recibió respuesta") {
      responseText = "Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?";
    }

    // Escapar caracteres especiales para XML
    responseText = responseText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    addLog("info", `RocketBot response processed: ${responseText}`);

    // Construir TwiML con la respuesta
    const twimlResponse = `<Response>
      <Say voice="${voiceConfig.defaultVoice.voice}">${responseText}</Say>
    </Response>`;

    // Configurar headers para evitar problemas de encoding
    res.set({
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });

    res.status(200).send(twimlResponse);
  } catch (err) {
    console.error("Error in /simple-response:", err);
    // Respuesta de error en TwiML con headers apropiados
    res.set({
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res
      .status(200)
      .send(
        `<Response><Say voice="${voiceConfig.defaultVoice.voice}">Lo siento, hubo un error procesando tu solicitud. Por favor, intenta de nuevo.</Say></Response>`,
      );
  }
});

// Ruta ultra-simple para evitar problemas de OpenSSL
app.post("/ultra-simple", async (req, res) => {
  try {
    addLog("info", "Received ultra-simple response from RocketBot");

    // Respuesta estática simple para evitar problemas
    const responseText =
      "Hola, soy tu asistente virtual de Owl Shoes. ¿En qué puedo ayudarte hoy?";

    addLog("info", `Using static response: ${responseText}`);

    // TwiML simple y limpio
    const twimlResponse = `<Response>
      <Say voice="${voiceConfig.defaultVoice.voice}">${responseText}</Say>
    </Response>`;

    // Headers mínimos para evitar problemas
    res.set({
      "Content-Type": "text/xml; charset=utf-8",
    });

    res.status(200).send(twimlResponse);
  } catch (err) {
    console.error("Error in /ultra-simple:", err);
    res.set({
      "Content-Type": "text/xml; charset=utf-8",
    });
    res
      .status(200)
      .send("<Response><Say>Hola, ¿en qué puedo ayudarte?</Say></Response>");
  }
});

// Ruta de prueba para verificar que el servidor funciona
app.get("/test", (req, res) => {
  res.json({
    status: "ok",
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

app.ws("/sockets", (ws) => {
  try {
    ws.on("error", console.error);
    // Filled in from start message
    let callSid;
    let localGptService; // Local GPT service for this WebSocket connection

    textService = new TextService(ws);

    let interactionCount = 0;

    // Incoming from MediaStream
    ws.on("message", function message(data) {
      console.log("📨 [WEBSOCKET] Received message, data type:", typeof data);
      console.log("📨 [WEBSOCKET] Data is Buffer:", Buffer.isBuffer(data));
      
      const msg = parseWebSocketMessage(data);
      if (!msg) return;
      
      console.log("📨 [WEBSOCKET] Parsed message:", msg);
      if (msg.type === "setup") {
        addLog("convrelay", `convrelay socket setup ${msg.callSid}`);
        callSid = msg.callSid;

        // Initialize GPT service if not already done
        if (!localGptService) {
          // Use global gptService if available, otherwise create a new one
          const model = record?.model || "gpt-4o";
          localGptService = gptService || createGptService(model);

          // If we're creating a new GPT service and have record data, set up the context
          if (!gptService && record) {
            localGptService.userContext.push({
              role: "system",
              content: record.sys_prompt,
            });
            localGptService.userContext.push({
              role: "system",
              content: record.profile,
            });
            localGptService.userContext.push({
              role: "system",
              content: record.orders,
            });
            localGptService.userContext.push({
              role: "system",
              content: record.inventory,
            });
            localGptService.userContext.push({
              role: "system",
              content: record.example,
            });
            localGptService.userContext.push({
              role: "system",
              content: `You can speak in many languages, but use default language ${record.language} for this conversation from now on! Remember it as the default language, even you change language in between. treat en-US and en-GB etc. as different languages.`,
            });
          }

          // Set up event listeners for this GPT service
          localGptService.on("gptreply", async (gptReply, final, icount) => {
            console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply}`.green);
            addLog(
              "gpt",
              `GPT -> convrelay: Interaction ${icount}: ${gptReply}`,
            );
            textService.sendText(gptReply, final);
          });

          localGptService.on(
            "tools",
            async (functionName, functionArgs, functionResponse) => {
              addLog(
                "gpt",
                `Function ${functionName} with args ${functionArgs}`,
              );
              addLog("gpt", `Function Response: ${functionResponse}`);

              if (functionName == "changeLanguage" && record?.changeSTT) {
                addLog(
                  "convrelay",
                  `convrelay ChangeLanguage to: ${functionArgs}`,
                );
                let jsonObj = JSON.parse(functionArgs);
                textService.setLang(jsonObj.language);
              }
            },
          );
        }

        localGptService.setCallInfo("user phone number", msg.from);

        //trigger gpt to start
        localGptService.completion("hello", interactionCount);
        interactionCount += 1;

        if (record?.recording) {
          recordingService(textService, callSid).then(() => {
            console.log(
              `Twilio -> Starting recording for ${callSid}`.underline.red,
            );
          });
        }
      }

      if (msg.type === "prompt") {
        const promptStartTime = Date.now();
        addLog(
          "convrelay",
          `⚡ PROMPT RECEIVED (${msg.lang}): ${msg.voicePrompt.substring(0, 50)}...`,
        );

        // Initialize GPT service if not already done (for direct testing)
        if (!localGptService) {
          const model = record?.model || "gpt-4o";
          localGptService = gptService || createGptService(model);

          // Contexto ultra-comprimido para máxima velocidad
          if (!gptService && record) {
            // Solo el prompt esencial y perfil básico
            localGptService.userContext.push({
              role: "system",
              content:
                record.sys_prompt ||
                "Eres María, una asistente humana de Rocketbot. SIEMPRE inicia la conversación presentándote con tu nombre completo: '¡Hola! Soy María de Rocketbot, una IA creada con Rocketbot SaturnStudio' y luego pregunta al cliente de manera cálida en qué puedes ayudarle.",
            });
            localGptService.userContext.push({
              role: "system",
              content: `Language: ${record.language || "es-ES"}`,
            });
          }

          // Event listeners optimizados
          localGptService.on("gptreply", async (gptReply, final, icount) => {
            const replyTime = Date.now() - promptStartTime;
            console.log(
              `⚡ ULTRA-FAST Reply (${replyTime}ms): ${gptReply.substring(0, 50)}...`
                .green,
            );
            addLog("gpt", `⚡ GPT Reply in ${replyTime}ms: ${gptReply}`);
            textService.sendText(gptReply, final);
          });

          localGptService.on(
            "tools",
            async (functionName, functionArgs, functionResponse) => {
              addLog("gpt", `Function ${functionName}: ${functionArgs}`);
              if (functionName == "changeLanguage" && record?.changeSTT) {
                addLog("convrelay", `Language change: ${functionArgs}`);
                let jsonObj = JSON.parse(functionArgs);
                textService.setLang(jsonObj.language);
              }
            },
          );
        }

        // Disparo inmediato sin await para no bloquear
        localGptService
          .completion(msg.voicePrompt, interactionCount)
          .catch((err) => {
            console.error("⚡ Completion error:", err);
          });
        interactionCount += 1;
      }

      if (msg.type === "interrupt") {
        addLog(
          "convrelay",
          "convrelay interrupt: utteranceUntilInterrupt: " +
            msg.utteranceUntilInterrupt +
            " durationUntilInterruptMs: " +
            msg.durationUntilInterruptMs,
        );
        if (localGptService) {
          localGptService.interrupt();
        }
        // console.log('Todo: add interruption handling');
      }

      if (msg.type === "error") {
        addLog("convrelay", "convrelay error: " + msg.description);

        console.log("Todo: add error handling");
      }

      if (msg.type === "dtmf") {
        addLog("convrelay", "convrelay dtmf: " + msg.digit);

        console.log("Todo: add dtmf handling");
      }
    });
  } catch (err) {
    console.log(err);
  }
});

// ========================================
// OUTBOUND CALL ENDPOINTS
// ========================================

// Endpoint para programar llamadas outbound
app.post("/schedule-call", async (req, res) => {
  try {
    addLog("info", "Scheduling outbound call");
    
    // Validar variables de entorno
    if (!process.env.TWILIO_FROM_NUMBER) {
      console.error("ERROR: TWILIO_FROM_NUMBER not set");
      return res.status(500).json({ error: "TWILIO_FROM_NUMBER not configured" });
    }
    
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.error("ERROR: TWILIO_ACCOUNT_SID not set");
      return res.status(500).json({ error: "TWILIO_ACCOUNT_SID not configured" });
    }
    
    if (!process.env.TWILIO_AUTH_TOKEN) {
      console.error("ERROR: TWILIO_AUTH_TOKEN not set");
      return res.status(500).json({ error: "TWILIO_AUTH_TOKEN not configured" });
    }
    
    const { 
      phoneNumber, 
      campaignId, 
      customerData, 
      scheduledTime = null 
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Crear llamada outbound usando Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    const callParams = {
      to: phoneNumber,
      from: process.env.TWILIO_FROM_NUMBER,
      url: `https://${process.env.SERVER}/outbound-voice`,
      statusCallback: `https://${process.env.SERVER}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      // DESHABILITAR MACHINE DETECTION PARA CONEXIÓN INMEDIATA
      machineDetection: 'Disable',
      // Configuración optimizada para conexión inmediata
      timeout: 30
    };

    // Si hay tiempo programado, usar TwiML para programar
    if (scheduledTime) {
      callParams.scheduleTime = new Date(scheduledTime);
    }

    const call = await client.calls.create(callParams);

    addLog("info", `Outbound call scheduled: ${call.sid} to ${phoneNumber}`);

    res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      message: "Call scheduled successfully"
    });

  } catch (error) {
    console.error("Error scheduling outbound call:", error);
    addLog("error", `Error scheduling call: ${error.message}`);
    res.status(500).json({ error: "Failed to schedule call" });
  }
});

// Endpoint para manejar la voz de llamadas outbound - ULTRA OPTIMIZADO
app.post("/outbound-voice", async (req, res) => {
  // Verificar si usar ElevenLabs
  const useElevenLabs = process.env.USE_ELEVENLABS === 'true';
  
  // Respuesta ULTRA-RÁPIDA sin try/catch ni operaciones innecesarias
  const response = `<Response>
    <Connect>
      <ConversationRelay 
        url="wss://${process.env.SERVER}/outbound-sockets?callType=outbound" 
        dtmfDetection="true" 
        ttsProvider="${useElevenLabs ? 'ElevenLabs' : 'Google'}" 
        voice="${useElevenLabs ? process.env.ELEVENLABS_VOICE_ID : 'es-ES-Neural2-C'}" 
        language="es-ES" 
        transcriptionProvider="Google" 
        speechModel="telephony_short"
        hints="${voiceConfig.speechRecognition.speechContext}"
        interruptible="speech"
        preemptible="true"
        reportInputDuringAgentSpeech="none"
        welcomeGreetingInterruptible="speech"
      />
    </Connect>
  </Response>`;
  
  res.type("text/xml");
  res.end(response.toString());
});

// Endpoint para recibir status de llamadas
app.post("/call-status", async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
    
    addLog("info", `Call status update: ${CallSid} - ${CallStatus}`);
    
    // Enviar status a Rocketbot SaturnStudio
    if (process.env.ROCKETBOT_WEBHOOK_URL) {
      await fetch(process.env.ROCKETBOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'call_status',
          callSid: CallSid,
          status: CallStatus,
          duration: CallDuration,
          recordingUrl: RecordingUrl,
          timestamp: new Date().toISOString()
        })
      });
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error("Error processing call status:", error);
    res.status(500).send('Error');
  }
});

// WebSocket para llamadas outbound
app.ws("/outbound-sockets", (ws) => {
  try {
    console.log("🔌 [WEBSOCKET] Outbound socket connection established");
    console.log("🔌 [WEBSOCKET] Remote address:", ws._socket?.remoteAddress);
    console.log("🔌 [WEBSOCKET] Headers:", ws.upgradeReq?.headers);
    console.log("🔌 [WEBSOCKET] URL:", ws.upgradeReq?.url);
    ws.on("error", (error) => {
      console.error("🔌 [WEBSOCKET] Outbound socket error:", error);
    });
    
    let callSid;
    let localGptService;
    let textService = new TextService(ws);
    let interactionCount = 0;
    let callStartTime = null; // Track when call starts
    let userInputEnabled = false; // Flag to control when to listen to user
    let mariaIsSpeaking = false; // Track if María is currently speaking

    ws.on("message", function message(data) {
      console.log("📨 [OUTBOUND-WEBSOCKET] Received message, data type:", typeof data);
      console.log("📨 [OUTBOUND-WEBSOCKET] Data is Buffer:", Buffer.isBuffer(data));
      
      const msg = parseWebSocketMessage(data);
      if (!msg) return;
      
      console.log("📨 [OUTBOUND-WEBSOCKET] Parsed message:", msg);
      console.log("🔌 [WEBSOCKET] Outbound socket message received:", msg.type);
      
      if (msg.type === "setup") {
        console.log("🔌 [WEBSOCKET] Setup received for call:", msg.callSid);
      }
      
      if (msg.type === "setup") {
        addLog("convrelay", `Outbound convrelay socket setup ${msg.callSid}`);
        callSid = msg.callSid;
        
        // Initialize call start time and disable user input initially
        callStartTime = Date.now();
        userInputEnabled = false;
        console.log("⏱️ [OUTBOUND-TIMER] Call started, user input disabled for 5 seconds");
        
        // Enable user input after 5 seconds
        setTimeout(() => {
          userInputEnabled = true;
          console.log("✅ [OUTBOUND-TIMER] User input enabled after 5 seconds");
          addLog("info", "User input enabled - ready to listen");
        }, 5000);

        // Configurar contexto de forma inmediata para evitar retrasos
        try {
          // Usar record global si está disponible, sino crear uno básico
          if (!record) {
            record = {
              sys_prompt: "Eres María de Rocketbot, una IA creada con Rocketbot SaturnStudio. Tu META PRINCIPAL es confirmar la asistencia al Summit Rocketbot 2025.",
              profile: "Customer profile information",
              orders: "Order history",
              inventory: "Available products",
              example: "Example conversations",
              model: "gpt-4o",
              language: "es-ES"
            };
          }
          
          gptService = createGptService(record.model);
          
          // Configurar contexto mínimo para máxima velocidad
          gptService.userContext.push({ role: "system", content: record.sys_prompt || "Eres María de Rocketbot, una IA creada con Rocketbot SaturnStudio. Tu META PRINCIPAL es confirmar la asistencia al Summit Rocketbot 2025." });
          gptService.userContext.push({ 
            role: "system", 
            content: `Esta es una llamada SALIENTE. Estás llamando al cliente. Tu objetivo es CONFIRMAR la asistencia al Summit Rocketbot 2025. Sé amable y preséntate como María, una IA creada con Rocketbot SaturnStudio.` 
          });
        } catch (error) {
          console.error("Error configuring context:", error);
        }

        // Inicializar GPT service para outbound de forma optimizada
        if (!localGptService) {
          const model = record?.model || "gpt-4o";
          localGptService = gptService || createGptService(model);

          // Configurar contexto mínimo para máxima velocidad
          if (!gptService && record) {
            localGptService.userContext.push({
              role: "system",
              content: record.sys_prompt || "Eres María de Rocketbot, una IA creada con Rocketbot SaturnStudio. Tu META PRINCIPAL es confirmar la asistencia al Summit Rocketbot 2025.",
            });
            localGptService.userContext.push({
              role: "system",
              content: `Esta es una llamada SALIENTE. Estás llamando al cliente. Tu objetivo es CONFIRMAR la asistencia al Summit Rocketbot 2025. Sé amable y preséntate como María de Rocketbot, una IA creada con Rocketbot SaturnStudio.`,
            });
          }

          // Event listeners optimizados para outbound
          localGptService.on("gptreply", async (gptReply, final, icount) => {
            console.log(`Outbound Interaction ${icount}: GPT -> TTS: ${gptReply}`.green);
            addLog("gpt", `Outbound GPT -> convrelay: Interaction ${icount}: ${gptReply}`);
            
            // Track María's speaking status
            if (!mariaIsSpeaking) {
              mariaIsSpeaking = true;
              console.log("🎤 [MARIA-STATUS] María started speaking - user input disabled");
            }
            
            textService.sendText(gptReply, final);
            
            // If this is the final part of the message, María finished speaking
            if (final) {
              mariaIsSpeaking = false;
              console.log("🎤 [MARIA-STATUS] María finished speaking - user input will be enabled");
            }
          });

          localGptService.on("tools", async (functionName, functionArgs, functionResponse) => {
            addLog("gpt", `Outbound Function ${functionName} with args ${functionArgs}`);
            addLog("gpt", `Outbound Function Response: ${functionResponse}`);

            if (functionName == "changeLanguage" && record?.changeSTT) {
              addLog("convrelay", `Outbound convrelay ChangeLanguage to: ${functionArgs}`);
              let jsonObj = JSON.parse(functionArgs);
              textService.setLang(jsonObj.language);
            }
          });

          // Event listener para terminar llamada cuando se confirma o declina asistencia
          localGptService.on("endCall", async (endCallData) => {
            console.log('📞 END CALL EVENT:', endCallData);
            addLog("gpt", `Call ending: ${endCallData.reason}`);
            
            const status = endCallData.confirmed ? 'confirmed' : 'declined';
            const message = endCallData.confirmed ? 'Summit attendance confirmed' : 'Summit attendance declined';
            
            console.log(`✅ ${message} - ending call in 11 seconds...`);
            addLog("info", `${message} - call will end in 11 seconds`);
            
            // Wait 11 seconds to let the final message be heard completely, then close WebSocket
            setTimeout(() => {
              console.log('📞 Closing WebSocket connection...');
              if (ws && ws.readyState === ws.OPEN) {
                ws.close(1000, `Summit attendance ${status}`);
              }
            }, 11000);
          });
        }

        // Configurar GPT service para outbound
        if (localGptService) {
          localGptService.setCallInfo("outbound call", "true");
          localGptService.setCallInfo("user phone number", msg.to);
          
          // Iniciar conversación
          localGptService.completion("start outbound call", interactionCount);
          interactionCount += 1;
        }

        if (record?.recording) {
          recordingService(textService, callSid).then(() => {
            console.log(`Outbound call recording started for ${callSid}`.underline.red);
          });
        }
      }

      if (msg.type === "prompt") {
        const promptStartTime = Date.now();
        
        // Check if user input should be ignored (first 5 seconds OR while María is speaking)
        if (!userInputEnabled || mariaIsSpeaking) {
          const timeElapsed = promptStartTime - callStartTime;
          const reason = !userInputEnabled ? 
            `initial period (${timeElapsed}ms elapsed, need 5000ms)` : 
            'María is currently speaking';
          console.log(`🚫 [OUTBOUND-IGNORE] Ignoring user input during ${reason}: "${msg.voicePrompt.substring(0, 30)}..."`);
          addLog("convrelay", `🚫 Ignoring user input during ${reason}: "${msg.voicePrompt.substring(0, 30)}..."`);
          return; // Ignore this prompt completely
        }
        
        addLog("convrelay", `⚡ OUTBOUND PROMPT RECEIVED (${msg.lang}): ${msg.voicePrompt.substring(0, 50)}...`);

        if (!localGptService) {
          const model = record?.model || "gpt-4o";
          localGptService = gptService || createGptService(model);

          if (!gptService && record) {
            localGptService.userContext.push({
              role: "system",
              content: record.sys_prompt || "Eres María de Rocketbot, una IA creada con Rocketbot SaturnStudio. Tu META PRINCIPAL es confirmar la asistencia al Summit Rocketbot 2025.",
            });
            localGptService.userContext.push({
              role: "system",
              content: `Language: ${record.language || "es-ES"}`,
            });
            localGptService.userContext.push({
              role: "system",
              content: "Esta es una llamada SALIENTE. Estás llamando al cliente. Tu objetivo es CONFIRMAR la asistencia al Summit Rocketbot 2025. Preséntate como María de Rocketbot.",
            });
          }

          localGptService.on("gptreply", async (gptReply, final, icount) => {
            const replyTime = Date.now() - promptStartTime;
            console.log(`⚡ OUTBOUND Reply (${replyTime}ms): ${gptReply.substring(0, 50)}...`.green);
            addLog("gpt", `⚡ Outbound GPT Reply in ${replyTime}ms: ${gptReply}`);
            
            // Track María's speaking status
            if (!mariaIsSpeaking) {
              mariaIsSpeaking = true;
              console.log("🎤 [MARIA-STATUS] María started speaking - user input disabled");
            }
            
            textService.sendText(gptReply, final);
            
            // If this is the final part of the message, María finished speaking
            if (final) {
              mariaIsSpeaking = false;
              console.log("🎤 [MARIA-STATUS] María finished speaking - user input will be enabled");
            }
          });

          localGptService.on("tools", async (functionName, functionArgs, functionResponse) => {
            addLog("gpt", `Outbound Function ${functionName}: ${functionArgs}`);
            if (functionName == "changeLanguage" && record?.changeSTT) {
              addLog("convrelay", `Outbound Language change: ${functionArgs}`);
              let jsonObj = JSON.parse(functionArgs);
              textService.setLang(jsonObj.language);
            }
          });

          // Event listener para terminar llamada cuando se confirma o declina asistencia
          localGptService.on("endCall", async (endCallData) => {
            console.log('📞 END CALL EVENT (Prompt Handler):', endCallData);
            addLog("gpt", `Call ending: ${endCallData.reason}`);
            
            const status = endCallData.confirmed ? 'confirmed' : 'declined';
            const message = endCallData.confirmed ? 'Summit attendance confirmed' : 'Summit attendance declined';
            
            console.log(`✅ ${message} - ending call in 11 seconds...`);
            addLog("info", `${message} - call will end in 11 seconds`);
            
            // Wait 11 seconds to let the final message be heard completely, then close WebSocket
            setTimeout(() => {
              console.log('📞 Closing WebSocket connection...');
              if (ws && ws.readyState === ws.OPEN) {
                ws.close(1000, `Summit attendance ${status}`);
              }
            }, 11000);
          });
        }

        localGptService.completion(msg.voicePrompt, interactionCount).catch((err) => {
          console.error("⚡ Outbound Completion error:", err);
        });
        interactionCount += 1;
      }

      if (msg.type === "interrupt") {
        console.log("🚫 [OUTBOUND-INTERRUPT] Ignoring interrupt to prevent message cancellation:", msg.utteranceUntilInterrupt);
        addLog("convrelay", "🚫 Outbound interrupt ignored to ensure complete message delivery");
        // Interruptions are disabled - do not call localGptService.interrupt()
        return;
      }

      if (msg.type === "error") {
        addLog("convrelay", "Outbound convrelay error: " + msg.description);
      }

      if (msg.type === "dtmf") {
        addLog("convrelay", "Outbound convrelay dtmf: " + msg.digit);
      }
    });
  } catch (err) {
    console.log("Outbound socket error:", err);
  }
});

// Endpoint para cancelar llamadas programadas
app.post("/cancel-call", async (req, res) => {
  try {
    const { callSid } = req.body;
    
    if (!callSid) {
      return res.status(400).json({ error: "Call SID is required" });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    await client.calls(callSid).update({ status: 'canceled' });
    
    addLog("info", `Call ${callSid} canceled successfully`);
    res.json({ success: true, message: "Call canceled successfully" });
    
  } catch (error) {
    console.error("Error canceling call:", error);
    res.status(500).json({ error: "Failed to cancel call" });
  }
});

// Endpoint para programar llamadas en lote
app.post("/schedule-batch", async (req, res) => {
  try {
    addLog("info", "Scheduling batch outbound calls");
    
    const { calls, campaignId } = req.body;

    if (!calls || !Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ error: "Calls array is required and must not be empty" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Campaign ID is required" });
    }

    const { OutboundService } = require('./services/outbound-service');
    const outboundService = new OutboundService();

    const results = [];
    const errors = [];

    for (const callData of calls) {
      try {
        // Validar número de teléfono
        if (!outboundService.validatePhoneNumber(callData.phoneNumber)) {
          const formattedNumber = outboundService.formatPhoneNumber(callData.phoneNumber);
          callData.phoneNumber = formattedNumber;
        }

        const result = await outboundService.scheduleCall({
          ...callData,
          campaignId
        });
        
        results.push(result);
        addLog("info", `Call scheduled successfully: ${callData.phoneNumber}`);
        
      } catch (error) {
        errors.push({
          phoneNumber: callData.phoneNumber,
          error: error.message
        });
        addLog("error", `Failed to schedule call for ${callData.phoneNumber}: ${error.message}`);
      }
    }

    const batchResult = {
      success: true,
      total: calls.length,
      successful: results.length,
      failed: errors.length,
      campaignId,
      results,
      errors
    };

    addLog("info", `Batch scheduling completed: ${results.length} successful, ${errors.length} failed`);

    res.json(batchResult);

  } catch (error) {
    console.error("Error scheduling batch calls:", error);
    addLog("error", `Batch scheduling error: ${error.message}`);
    res.status(500).json({ error: "Failed to schedule batch calls" });
  }
});

// Endpoint para obtener estadísticas de llamadas
app.get("/call-stats", async (req, res) => {
  try {
    const { OutboundService } = require('./services/outbound-service');
    const outboundService = new OutboundService();
    
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status
    };

    const stats = await outboundService.getCallStats(filters);
    
    res.json(stats);
    
  } catch (error) {
    console.error("Error getting call stats:", error);
    res.status(500).json({ error: "Failed to get call statistics" });
  }
});

// Endpoint para obtener detalles de una llamada específica
app.get("/call-details/:callSid", async (req, res) => {
  try {
    const { callSid } = req.params;
    
    if (!callSid) {
      return res.status(400).json({ error: "Call SID is required" });
    }

    const { OutboundService } = require('./services/outbound-service');
    const outboundService = new OutboundService();

    const callDetails = await outboundService.getCallDetails(callSid);
    
    addLog("info", `Call details retrieved for ${callSid}`);
    res.json(callDetails);
    
  } catch (error) {
    console.error("Error getting call details:", error);
    addLog("error", `Error getting call details for ${req.params.callSid}: ${error.message}`);
    res.status(500).json({ error: "Failed to get call details" });
  }
});

// Endpoint de salud del sistema
app.get("/health", (req, res) => {
  const { HybridTTSService } = require('./services/hybrid-tts-service');
  const hybridTTS = new HybridTTSService();
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      twilio: process.env.TWILIO_ACCOUNT_SID ? "configured" : "not_configured",
      rocketbot: process.env.ROCKETBOT_WEBHOOK_URL ? "configured" : "not_configured",
      airtable: process.env.AIRTABLE_API_KEY ? "configured" : "not_configured",
      elevenlabs: process.env.ELEVENLABS_API_KEY ? "configured" : "not_configured"
    },
    tts: hybridTTS.getServiceInfo()
  });
});

// Endpoint para probar ElevenLabs
app.get("/test-elevenlabs", async (req, res) => {
  try {
    const { ElevenLabsService } = require('./services/elevenlabs-service');
    const elevenLabs = new ElevenLabsService();

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(400).json({ 
        error: "ELEVENLABS_API_KEY not configured" 
      });
    }

    const voices = await elevenLabs.getVoices();
    const spanishVoices = await elevenLabs.getVoicesByLanguage('es');
    const recommendedVoices = elevenLabs.getRecommendedSpanishVoices();
    
    console.log("🎤 [ELEVENLABS] Available voices:", voices.length);
    console.log("🎤 [ELEVENLABS] Spanish voices:", spanishVoices.length);
    
    res.json({
      success: true,
      totalVoices: voices.length,
      spanishVoices: spanishVoices.slice(0, 10),
      recommendedVoices: recommendedVoices
    });

  } catch (error) {
    console.error("🎤 [ELEVENLABS] Error:", error);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Endpoint para generar audio con ElevenLabs
app.post("/generate-audio", async (req, res) => {
  try {
    const { ElevenLabsService } = require('./services/elevenlabs-service');
    const elevenLabs = new ElevenLabsService();

    const { text, voiceId, options } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const audioBuffer = await elevenLabs.textToSpeech(text, voiceId, options);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });
    
    res.send(audioBuffer);

  } catch (error) {
    console.error("🎤 [ELEVENLABS] Audio generation error:", error);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Endpoint para probar tu voz específica
app.post("/test-your-voice", async (req, res) => {
  try {
    const { ElevenLabsService } = require('./services/elevenlabs-service');
    const elevenLabs = new ElevenLabsService();

    const { text = "Hola, soy el asistente virtual de Owl Shoes. ¿En qué puedo ayudarte?" } = req.body;
    const voiceId = 'JM2A9JbRp8XUJ7bdCXJc';

    console.log(`🎤 [YOUR-VOICE] Testing voice ${voiceId} with text: ${text.substring(0, 50)}...`);

    const audioBuffer = await elevenLabs.textToSpeech(text, voiceId);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });
    
    res.send(audioBuffer);

  } catch (error) {
    console.error("🎤 [YOUR-VOICE] Error:", error);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Endpoint para probar el servicio híbrido TTS
app.post("/test-hybrid-tts", async (req, res) => {
  try {
    const { HybridTTSService } = require('./services/hybrid-tts-service');
    const hybridTTS = new HybridTTSService();

    const { text = "Hola, soy el asistente virtual de Owl Shoes. ¿En qué puedo ayudarte?" } = req.body;

    console.log(`🎤 [HYBRID-TTS] Testing with text: ${text.substring(0, 50)}...`);
    console.log(`🎤 [HYBRID-TTS] Service info:`, hybridTTS.getServiceInfo());

    const audioBuffer = await hybridTTS.generateSpeech(text);
    
    if (audioBuffer) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      });
      res.send(audioBuffer);
    } else {
      res.json({
        message: "Using default TTS (no audio buffer returned)",
        serviceInfo: hybridTTS.getServiceInfo()
      });
    }

  } catch (error) {
    console.error("🎤 [HYBRID-TTS] Error:", error);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Endpoint para probar la comunicación con N8N
app.post("/test-n8n", async (req, res) => {
  try {
    if (!process.env.ROCKETBOT_WEBHOOK_URL) {
      return res.status(400).json({ 
        error: "ROCKETBOT_WEBHOOK_URL not configured" 
      });
    }

    const testData = {
      type: 'test_connection',
      message: 'Testing N8N webhook connection',
      timestamp: new Date().toISOString(),
      source: 'outbound-service-test'
    };

    console.log("🧪 [TEST-N8N] Sending test data to:", process.env.ROCKETBOT_WEBHOOK_URL);
    console.log("🧪 [TEST-N8N] Test data:", testData);

    const response = await fetch(process.env.ROCKETBOT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OwlShoes-Outbound-Service/1.0'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log("🧪 [TEST-N8N] Response status:", response.status);
    console.log("🧪 [TEST-N8N] Response body:", responseText);

    res.json({
      success: response.ok,
      status: response.status,
      response: responseText,
      webhookUrl: process.env.ROCKETBOT_WEBHOOK_URL
    });

  } catch (error) {
    console.error("🧪 [TEST-N8N] Error:", error);
    res.status(500).json({ 
      error: error.message,
      webhookUrl: process.env.ROCKETBOT_WEBHOOK_URL
    });
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

// Log service configuration
const useRealtime = process.env.USE_REALTIME_API === "true";
console.log("=".repeat(50));
console.log("🔧 [CONFIG] Service Configuration:");
console.log(
  `   📡 N8N Standard Service: ${!useRealtime ? "✅ ENABLED" : "❌ DISABLED"}`,
);
console.log(
  `   🚀 N8N Realtime API: ${useRealtime ? "✅ ENABLED" : "❌ DISABLED"}`,
);
console.log(
  `   🔑 USE_REALTIME_API: ${process.env.USE_REALTIME_API || "false"}`,
);
console.log("=".repeat(50));
