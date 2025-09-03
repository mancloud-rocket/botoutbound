const { ElevenLabsService } = require('./elevenlabs-service');

class HybridTTSService {
  constructor() {
    this.elevenLabs = new ElevenLabsService();
    this.useElevenLabs = process.env.USE_ELEVENLABS === 'true';
    this.defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'JM2A9JbRp8XUJ7bdCXJc';
    
    console.log(`🎤 [HYBRID-TTS] Service initialized`);
    console.log(`🎤 [HYBRID-TTS] Use ElevenLabs: ${this.useElevenLabs}`);
    console.log(`🎤 [HYBRID-TTS] Default voice: ${this.defaultVoiceId}`);
  }

  /**
   * Generar audio usando el servicio configurado
   */
  async generateSpeech(text, options = {}) {
    if (this.useElevenLabs && this.elevenLabs.apiKey) {
      return await this.generateElevenLabsSpeech(text, options);
    } else {
      return await this.generateGoogleSpeech(text, options);
    }
  }

  /**
   * Generar audio con ElevenLabs
   */
  async generateElevenLabsSpeech(text, options = {}) {
    try {
      console.log(`🎤 [ELEVENLABS-TTS] Generating speech: ${text.substring(0, 50)}...`);
      
      const voiceId = options.voiceId || this.defaultVoiceId;
      const audioBuffer = await this.elevenLabs.textToSpeech(text, voiceId, options);
      
      console.log(`✅ [ELEVENLABS-TTS] Audio generated successfully`);
      return audioBuffer;
    } catch (error) {
      console.error(`❌ [ELEVENLABS-TTS] Error: ${error.message}`);
      // Fallback a Google TTS
      console.log(`🔄 [HYBRID-TTS] Falling back to Google TTS`);
      return await this.generateGoogleSpeech(text, options);
    }
  }

  /**
   * Generar audio con Google TTS (fallback)
   */
  async generateGoogleSpeech(text, options = {}) {
    try {
      console.log(`🎤 [GOOGLE-TTS] Generating speech: ${text.substring(0, 50)}...`);
      
      // Aquí iría la lógica de Google TTS si la necesitas
      // Por ahora solo retornamos null para que use el TTS por defecto
      console.log(`✅ [GOOGLE-TTS] Using default TTS`);
      return null;
    } catch (error) {
      console.error(`❌ [GOOGLE-TTS] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtener información del servicio activo
   */
  getServiceInfo() {
    return {
      activeService: this.useElevenLabs ? 'ElevenLabs' : 'Google TTS',
      voiceId: this.defaultVoiceId,
      useElevenLabs: this.useElevenLabs,
      elevenLabsConfigured: !!this.elevenLabs.apiKey
    };
  }
}

module.exports = { HybridTTSService }; 