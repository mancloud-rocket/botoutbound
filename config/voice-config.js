module.exports = {
  // Configuración de voz principal optimizada para baja latencia
  defaultVoice: {
    language: "es-ES",
    voice: "es-ES-Neural2-C",
    ttsProvider: "Google",
  },

  // Configuración de reconocimiento de voz optimizada para baja latencia
  speechRecognition: {
    transcriptionProvider: "Google",
    speechModel: "telephony",
    speechContext:
      "asistente, virtual, consulta, información, ayuda, servicio, atención, cliente",
  },

  // Voces alternativas por idioma
  alternativeVoices: {
    "es-ES": {
      primary: "es-ES-Neural2-C",
      secondary: "es-ES-Neural2-D",
      tertiary: "es-ES-Neural2-E",
    },
    "fr-FR": {
      primary: "fr-FR-Neural2-C",
      secondary: "fr-FR-Neural2-D",
    },
    "en-US": {
      primary: "en-US-Neural2-C",
      secondary: "en-US-Neural2-D",
    },
  },

  // Saludos instantáneos por idioma
  instantGreetings: {
    "es-ES":
      "¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?",
    "fr-FR":
      "Bonjour! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui?",
    "en-US":
      "Hello! I'm your virtual assistant. How can I help you today?",
  },
};
