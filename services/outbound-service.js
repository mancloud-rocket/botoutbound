require('dotenv').config();
const twilio = require('twilio');
const fetch = require('node-fetch');

class OutboundService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    
    // Debugging de variables
    console.log("=== OUTBOUND SERVICE DEBUG ===");
    console.log("FROM_NUMBER:", this.fromNumber);
    console.log("ACCOUNT_SID:", this.accountSid);
    console.log("AUTH_TOKEN:", this.authToken ? "SET" : "NOT SET");
    console.log("==============================");
    
    this.client = twilio(this.accountSid, this.authToken);
    this.rocketbotWebhookUrl = process.env.ROCKETBOT_WEBHOOK_URL;
  }

  /**
   * Programa una llamada outbound
   * @param {Object} callData - Datos de la llamada
   * @returns {Promise<Object>} - Resultado de la programación
   */
  async scheduleCall(callData) {
    try {
      const {
        phoneNumber,
        campaignId,
        customerData = {},
        scheduledTime = null,
        priority = 'normal'
      } = callData;

      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

      const callParams = {
        to: phoneNumber,
        from: this.fromNumber,
        url: `https://${process.env.SERVER}/outbound-voice`,
        statusCallback: `https://${process.env.SERVER}/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // DESHABILITAR MACHINE DETECTION PARA CONEXIÓN INMEDIATA
        machineDetection: 'Disable',
        // Configuración optimizada para conexión inmediata
        timeout: 30,
        // Parámetros adicionales para outbound
        record: true,
        recordingChannels: 'dual',
        recordingStatusCallback: `https://${process.env.SERVER}/recording-status`,
        // Datos personalizados
        customData: JSON.stringify({
          campaignId,
          customerData,
          priority,
          scheduledTime
        })
      };

      if (scheduledTime) {
        callParams.scheduleTime = new Date(scheduledTime);
      }

      const call = await this.client.calls.create(callParams);

      // Enviar información a Rocketbot SaturnStudio
      await this.notifyRocketbot({
        type: 'call_scheduled',
        callSid: call.sid,
        phoneNumber,
        campaignId,
        customerData,
        scheduledTime,
        priority
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: 'Call scheduled successfully'
      };

    } catch (error) {
      console.error('Error scheduling outbound call:', error);
      throw error;
    }
  }

  /**
   * Programa múltiples llamadas en lote
   * @param {Array} callList - Lista de llamadas a programar
   * @returns {Promise<Object>} - Resultado del lote
   */
  async scheduleBatchCalls(callList) {
    try {
      const results = [];
      const errors = [];

      for (const callData of callList) {
        try {
          const result = await this.scheduleCall(callData);
          results.push(result);
        } catch (error) {
          errors.push({
            phoneNumber: callData.phoneNumber,
            error: error.message
          });
        }
      }

      return {
        success: true,
        total: callList.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      console.error('Error scheduling batch calls:', error);
      throw error;
    }
  }

  /**
   * Cancela una llamada programada
   * @param {string} callSid - SID de la llamada
   * @returns {Promise<Object>} - Resultado de la cancelación
   */
  async cancelCall(callSid) {
    try {
      await this.client.calls(callSid).update({ status: 'canceled' });

      await this.notifyRocketbot({
        type: 'call_canceled',
        callSid
      });

      return {
        success: true,
        message: 'Call canceled successfully'
      };

    } catch (error) {
      console.error('Error canceling call:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de llamadas
   * @param {Object} filters - Filtros para las estadísticas
   * @returns {Promise<Object>} - Estadísticas de llamadas
   */
  async getCallStats(filters = {}) {
    try {
      const { startDate, endDate, status } = filters;
      
      let callList = await this.client.calls.list({ 
        limit: 1000,
        ...(startDate && { startTime: { gte: new Date(startDate) } }),
        ...(endDate && { startTime: { lte: new Date(endDate) } }),
        ...(status && { status })
      });

      const stats = {
        total: callList.length,
        completed: callList.filter(c => c.status === 'completed').length,
        failed: callList.filter(c => c.status === 'failed').length,
        busy: callList.filter(c => c.status === 'busy').length,
        noAnswer: callList.filter(c => c.status === 'no-answer').length,
        canceled: callList.filter(c => c.status === 'canceled').length,
        inProgress: callList.filter(c => c.status === 'in-progress').length,
        ringing: callList.filter(c => c.status === 'ringing').length,
        queued: callList.filter(c => c.status === 'queued').length,
        averageDuration: this.calculateAverageDuration(callList)
      };

      return stats;

    } catch (error) {
      console.error('Error getting call stats:', error);
      throw error;
    }
  }

  /**
   * Calcula la duración promedio de las llamadas
   * @param {Array} calls - Lista de llamadas
   * @returns {number} - Duración promedio en segundos
   */
  calculateAverageDuration(calls) {
    const completedCalls = calls.filter(c => c.status === 'completed' && c.duration);
    if (completedCalls.length === 0) return 0;
    
    const totalDuration = completedCalls.reduce((sum, call) => sum + parseInt(call.duration), 0);
    return Math.round(totalDuration / completedCalls.length);
  }

  /**
   * Notifica a Rocketbot SaturnStudio sobre eventos
   * @param {Object} data - Datos a enviar
   * @returns {Promise<void>}
   */
  async notifyRocketbot(data) {
    if (!this.rocketbotWebhookUrl) {
      console.log('Rocketbot webhook URL not configured, skipping notification');
      return;
    }

    try {
      await fetch(this.rocketbotWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OwlShoes-Outbound-Service/1.0'
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          source: 'outbound-service'
        })
      });
    } catch (error) {
      console.error('Error notifying Rocketbot:', error);
    }
  }

  /**
   * Obtiene información detallada de una llamada
   * @param {string} callSid - SID de la llamada
   * @returns {Promise<Object>} - Información de la llamada
   */
  async getCallDetails(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      const recordings = await this.client.calls(callSid).recordings.list();
      
      return {
        callSid: call.sid,
        status: call.status,
        duration: call.duration,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime,
        price: call.price,
        priceUnit: call.priceUnit,
        recordings: recordings.map(r => ({
          sid: r.sid,
          duration: r.duration,
          status: r.status,
          uri: r.uri
        }))
      };

    } catch (error) {
      console.error('Error getting call details:', error);
      throw error;
    }
  }

  /**
   * Valida un número de teléfono
   * @param {string} phoneNumber - Número a validar
   * @returns {boolean} - Si el número es válido
   */
  validatePhoneNumber(phoneNumber) {
    // Validación básica de formato E.164
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Formatea un número de teléfono a formato E.164
   * @param {string} phoneNumber - Número a formatear
   * @param {string} countryCode - Código de país por defecto
   * @returns {string} - Número formateado
   */
  formatPhoneNumber(phoneNumber, countryCode = '+1') {
    // Remover todos los caracteres no numéricos
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Si no empieza con +, agregar código de país
    if (!phoneNumber.startsWith('+')) {
      cleaned = countryCode + cleaned;
    }
    
    return cleaned;
  }
}

module.exports = { OutboundService }; 