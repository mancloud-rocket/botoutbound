const fetch = require('node-fetch');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    
    if (!this.apiKey) {
      console.warn("⚠️ [ELEVENLABS] API Key not configured");
    } else {
      console.log("🎤 [ELEVENLABS] Service initialized");
    }
  }

  /**
   * Obtener lista de voces disponibles
   */
  async getVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error("❌ [ELEVENLABS] Error getting voices:", error);
      return [];
    }
  }

  /**
   * Generar audio a partir de texto
   */
  async textToSpeech(text, voiceId = 'JM2A9JbRp8XUJ7bdCXJc', options = {}) {
    try {
      const payload = {
        text: text,
        model_id: options.model || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.75,
          style: options.style || 0.0,
          use_speaker_boost: options.useSpeakerBoost || true
        }
      };

      console.log(`🎤 [ELEVENLABS] Generating speech for: ${text.substring(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log(`✅ [ELEVENLABS] Audio generated: ${audioBuffer.byteLength} bytes`);

      return Buffer.from(audioBuffer);
    } catch (error) {
      console.error("❌ [ELEVENLABS] Error generating speech:", error);
      throw error;
    }
  }

  /**
   * Obtener información de una voz específica
   */
  async getVoiceInfo(voiceId) {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("❌ [ELEVENLABS] Error getting voice info:", error);
      return null;
    }
  }

  /**
   * Buscar voces por idioma
   */
  async getVoicesByLanguage(language = 'es') {
    const voices = await this.getVoices();
    return voices.filter(voice => 
      voice.labels?.language?.toLowerCase().includes(language.toLowerCase())
    );
  }

  /**
   * Obtener voces recomendadas para español
   */
  getRecommendedSpanishVoices() {
    return [
      {
        id: 'JM2A9JbRp8XUJ7bdCXJc',
        name: 'Tu Voz Seleccionada',
        description: 'Voz personalizada seleccionada por el usuario'
      },
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Voz clara y profesional'
      },
      {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        description: 'Voz cálida y amigable'
      },
      {
        id: 'VR6AewLTigWG4xSOukaG',
        name: 'Arnold',
        description: 'Voz masculina profesional'
      }
    ];
  }
}

module.exports = { ElevenLabsService }; 