require('dotenv').config();
require('colors');
require('log-timestamp');


const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { GptServiceRealtime } = require('./services/gpt-service-realtime');
const { TextService } = require('./services/text-service');
const { recordingService } = require('./services/recording-service');

const { prompt, userProfile, orderHistory } = require('./services/prompt');

const { getLatestRecord } = require('./services/airtable-service');

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
  const useRealtime = process.env.USE_REALTIME_API === 'true';
  
  if (useRealtime) {
    console.log('🚀 [SERVICE] Using N8N Realtime API (Optimized)'.green);
    addLog('info', '🚀 [SERVICE] Using N8N Realtime API (Optimized)');
    return new GptServiceRealtime();
  } else {
    console.log('📡 [SERVICE] Using N8N Standard Service'.blue);
    addLog('info', '📡 [SERVICE] Using N8N Standard Service');
    return new GptService(model);
  }
}
// Add this code after creating the Express app

app.get('/monitor', (req, res) => {
  res.sendFile(__dirname + '/monitor.html');
});

// Initialize an array to store logs
const logs = [];

// Method to add logs
function addLog(level, message) {
    console.log(message);
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, level, message });
}

// Route to retrieve logs
app.get('/logs', (req, res) => {
    res.json(logs);
});


app.post('/incoming', async (req, res) => {
  try {
    logs.length = 0; // Clear logs
    addLog('info', 'incoming call started');
    
    // Get latest record from airtable
    record = await getLatestRecord();
    // console.log('Get latest record ', record);

    // Initialize GPT service (standard or realtime)
    gptService = createGptService(record.model);
    
    gptService.userContext.push({ 'role': 'system', 'content': record.sys_prompt });
    gptService.userContext.push({ 'role': 'system', 'content': record.profile });
    gptService.userContext.push({ 'role': 'system', 'content': record.orders });
    gptService.userContext.push({ 'role': 'system', 'content': record.inventory });
    gptService.userContext.push({ 'role': 'system', 'content': record.example });
    gptService.userContext.push({ 'role': 'system', 'content': `You can speak in many languages, but use default language es-ES for this conversation from now on! Remember it as the default language, even you change language in between. treat en-US and en-GB etc. as different languages.`});
    

    addLog('info', `language : es-ES, voice : es-ES-Neural2-B, ttsProvider : google, transcriptionProvider : google`, );
    
    const response = 
    `<Response>
      <Connect>
        <ConversationRelay url="wss://${process.env.SERVER}/sockets" dtmfDetection="true" ttsProvider="google" voice="es-ES-Neural2-B" language="es-ES" transcriptionProvider="google" speakingRate="1.8">
          <Language code="fr-FR" ttsProvider="google" voice="fr-FR-Neural2-B" />
          <Language code="es-ES" ttsProvider="google" voice="es-ES-Neural2-B" />
        </ConversationRelay>
      </Connect>
    </Response>`;
    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.error('Error in /incoming:', err);
    // RESPONDE A TWILIO PARA EVITAR TIMEOUT
    res.type('text/xml');
    res.status(200).send('<Response><Say voice="es-ES-Neural2-B">Lo siento, el sistema no está disponible en este momento.</Say></Response>');
  }
});

// Nueva ruta para recibir respuestas simples de RocketBot
app.post('/simple-response', async (req, res) => {
  try {
    addLog('info', 'Received simple response from RocketBot');
    
    // Obtener el string de respuesta del body con múltiples fallbacks
    let responseText = 'No se recibió respuesta';
    
    // Intentar diferentes formas de obtener la respuesta
    if (req.body && typeof req.body === 'object') {
      responseText = req.body.response || req.body.text || req.body.message || req.body.content || 'No se recibió respuesta';
    } else if (typeof req.body === 'string') {
      responseText = req.body;
    }
    
    // Limpiar y validar la respuesta
    responseText = responseText.toString().trim();
    if (!responseText || responseText === 'No se recibió respuesta') {
      responseText = 'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?';
    }
    
    // Escapar caracteres especiales para XML
    responseText = responseText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    addLog('info', `RocketBot response processed: ${responseText}`);
    
    // Construir TwiML con la respuesta
    const twimlResponse = 
    `<Response>
      <Say voice="es-ES-Neural2-B">${responseText}</Say>
    </Response>`;
    
    // Configurar headers para evitar problemas de encoding
    res.set({
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.status(200).send(twimlResponse);
    
  } catch (err) {
    console.error('Error in /simple-response:', err);
    // Respuesta de error en TwiML con headers apropiados
    res.set({
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.status(200).send('<Response><Say voice="es-ES-Neural2-B">Lo siento, hubo un error procesando tu solicitud. Por favor, intenta de nuevo.</Say></Response>');
  }
});

// Ruta ultra-simple para evitar problemas de OpenSSL
app.post('/ultra-simple', async (req, res) => {
  try {
    addLog('info', 'Received ultra-simple response from RocketBot');
    
    // Respuesta estática simple para evitar problemas
    const responseText = 'Hola, soy tu asistente virtual de Owl Shoes. ¿En qué puedo ayudarte hoy?';
    
    addLog('info', `Using static response: ${responseText}`);
    
    // TwiML simple y limpio
    const twimlResponse = 
    `<Response>
      <Say voice="es-ES-Neural2-B">${responseText}</Say>
    </Response>`;
    
    // Headers mínimos para evitar problemas
    res.set({
      'Content-Type': 'text/xml; charset=utf-8'
    });
    
    res.status(200).send(twimlResponse);
    
  } catch (err) {
    console.error('Error in /ultra-simple:', err);
    res.set({
      'Content-Type': 'text/xml; charset=utf-8'
    });
    res.status(200).send('<Response><Say>Hola, ¿en qué puedo ayudarte?</Say></Response>');
  }
});

// Ruta de prueba para verificar que el servidor funciona
app.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

app.ws('/sockets', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let callSid;
    let localGptService; // Local GPT service for this WebSocket connection

    textService = new TextService(ws);

    let interactionCount = 0;
    
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      console.log(msg);
      if (msg.type === 'setup') {
        addLog('convrelay', `convrelay socket setup ${msg.callSid}`);
        callSid = msg.callSid;
        
        // Initialize GPT service if not already done
        if (!localGptService) {
          // Use global gptService if available, otherwise create a new one
          const model = record?.model || 'gpt-4o';
          localGptService = gptService || createGptService(model);
          
          // If we're creating a new GPT service and have record data, set up the context
          if (!gptService && record) {
            localGptService.userContext.push({ 'role': 'system', 'content': record.sys_prompt });
            localGptService.userContext.push({ 'role': 'system', 'content': record.profile });
            localGptService.userContext.push({ 'role': 'system', 'content': record.orders });
            localGptService.userContext.push({ 'role': 'system', 'content': record.inventory });
            localGptService.userContext.push({ 'role': 'system', 'content': record.example });
            localGptService.userContext.push({ 'role': 'system', 'content': `You can speak in many languages, but use default language ${record.language} for this conversation from now on! Remember it as the default language, even you change language in between. treat en-US and en-GB etc. as different languages.`});
          }
          
          // Set up event listeners for this GPT service
          localGptService.on('gptreply', async (gptReply, final, icount) => {
            console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply}`.green );
            addLog('gpt', `GPT -> convrelay: Interaction ${icount}: ${gptReply}`);
            textService.sendText(gptReply, final);
          });

          localGptService.on('tools', async (functionName, functionArgs, functionResponse) => {
            addLog('gpt', `Function ${functionName} with args ${functionArgs}`);
            addLog('gpt', `Function Response: ${functionResponse}`);

            if(functionName == 'changeLanguage' && record?.changeSTT){
              addLog('convrelay', `convrelay ChangeLanguage to: ${functionArgs}`);
              let jsonObj = JSON.parse(functionArgs);
              textService.setLang(jsonObj.language);
            }
          });
        }
        
        localGptService.setCallInfo('user phone number', msg.from);

        //trigger gpt to start 
        localGptService.completion('hello', interactionCount);
        interactionCount += 1;

        if(record?.recording){
        recordingService(textService, callSid).then(() => {
            console.log(`Twilio -> Starting recording for ${callSid}`.underline.red);
          });
        }
      }  
      
      if (msg.type === 'prompt') {
        const promptStartTime = Date.now();
        addLog('convrelay', `⚡ PROMPT RECEIVED (${msg.lang}): ${msg.voicePrompt.substring(0, 50)}...`);
        
        // Initialize GPT service if not already done (for direct testing)
        if (!localGptService) {
          const model = record?.model || 'gpt-4o';
          localGptService = gptService || createGptService(model);
          
          // Contexto ultra-comprimido para máxima velocidad
          if (!gptService && record) {
            // Solo el prompt esencial y perfil básico
            localGptService.userContext.push({ 'role': 'system', 'content': record.sys_prompt?.substring(0, 500) || 'You are Owl Shoes assistant' });
            localGptService.userContext.push({ 'role': 'system', 'content': `Language: ${record.language || 'es-ES'}` });
          }
          
          // Event listeners optimizados
          localGptService.on('gptreply', async (gptReply, final, icount) => {
            const replyTime = Date.now() - promptStartTime;
            console.log(`⚡ ULTRA-FAST Reply (${replyTime}ms): ${gptReply.substring(0, 50)}...`.green);
            addLog('gpt', `⚡ GPT Reply in ${replyTime}ms: ${gptReply}`);
            textService.sendText(gptReply, final);
          });

          localGptService.on('tools', async (functionName, functionArgs, functionResponse) => {
            addLog('gpt', `Function ${functionName}: ${functionArgs}`);
            if(functionName == 'changeLanguage' && record?.changeSTT){
              addLog('convrelay', `Language change: ${functionArgs}`);
              let jsonObj = JSON.parse(functionArgs);
              textService.setLang(jsonObj.language);
            }
          });
        }
        
        // Disparo inmediato sin await para no bloquear
        localGptService.completion(msg.voicePrompt, interactionCount).catch(err => {
          console.error('⚡ Completion error:', err);
        });
        interactionCount += 1;
      } 
      
      if (msg.type === 'interrupt') {
        addLog('convrelay', 'convrelay interrupt: utteranceUntilInterrupt: ' + msg.utteranceUntilInterrupt + ' durationUntilInterruptMs: ' + msg.durationUntilInterruptMs);
        if (localGptService) {
          localGptService.interrupt();
        }
        // console.log('Todo: add interruption handling');
      }

      if (msg.type === 'error') {
        addLog('convrelay', 'convrelay error: ' + msg.description);
        
        console.log('Todo: add error handling');
      }

      if (msg.type === 'dtmf') {
        addLog('convrelay', 'convrelay dtmf: ' + msg.digit);
        
        console.log('Todo: add dtmf handling');
      }



    });

  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

// Log service configuration
const useRealtime = process.env.USE_REALTIME_API === 'true';
console.log('='.repeat(50));
console.log('🔧 [CONFIG] Service Configuration:');
console.log(`   📡 N8N Standard Service: ${!useRealtime ? '✅ ENABLED' : '❌ DISABLED'}`);
console.log(`   🚀 N8N Realtime API: ${useRealtime ? '✅ ENABLED' : '❌ DISABLED'}`);
console.log(`   🔑 USE_REALTIME_API: ${process.env.USE_REALTIME_API || 'false'}`);
console.log('='.repeat(50));
