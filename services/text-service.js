const EventEmitter = require('events');

class TextService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
  }

  sendText (text, last) {
    console.log('🔊 [TEXT SERVICE] Sending text (COMPLETE):', text);
    console.log('🔊 [TEXT SERVICE] Last:', last);
    console.log('🔊 [TEXT SERVICE] Full text length:', text.length);
    console.log('📝 [TEXT SERVICE] Complete text being sent:', text);
    
    try {
      // Enviar respuesta completa de una vez
      this.ws.send(
        JSON.stringify({
          type: 'text',
          token: text,
          last: true, // Siempre marcar como final para evitar streaming
        })
      );
      console.log('✅ [TEXT SERVICE] Complete text sent successfully');
    } catch (error) {
      console.error('❌ [TEXT SERVICE] Error sending text:', error);
    }
  }

  setLang(language){
    
    console.log('setLang: |', language);
    this.ws.send(
      JSON.stringify({
        type: 'language',
        ttsLanguage: language,
        transcriptionLanguage: language,
      })
    );

  }
}

module.exports = {TextService};