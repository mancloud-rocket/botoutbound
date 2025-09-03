require('dotenv').config();
const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER || 'http://localhost:3001';

/**
 * Script de prueba para las funcionalidades outbound
 */
class OutboundTester {
  constructor() {
    this.serverUrl = SERVER_URL;
  }

  /**
   * Prueba programar una llamada individual
   */
  async testScheduleSingleCall() {
    console.log('🧪 Testing single call scheduling...');
    
    try {
      const response = await fetch(`${this.serverUrl}/schedule-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: '+1234567890',
          campaignId: 'test_campaign_001',
          customerData: {
            name: 'Test Customer',
            email: 'test@example.com',
            preferences: ['running', 'casual']
          },
          scheduledTime: new Date(Date.now() + 60000).toISOString(), // 1 minuto en el futuro
          priority: 'high'
        })
      });

      const result = await response.json();
      console.log('✅ Single call scheduled:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error scheduling single call:', error);
      throw error;
    }
  }

  /**
   * Prueba programar múltiples llamadas en lote
   */
  async testScheduleBatchCalls() {
    console.log('🧪 Testing batch call scheduling...');
    
    try {
      const response = await fetch(`${this.serverUrl}/schedule-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId: 'test_batch_campaign_001',
          calls: [
            {
              phoneNumber: '+1234567890',
              customerData: {
                name: 'Customer 1',
                email: 'customer1@example.com'
              }
            },
            {
              phoneNumber: '+1234567891',
              customerData: {
                name: 'Customer 2',
                email: 'customer2@example.com'
              }
            },
            {
              phoneNumber: '+1234567892',
              customerData: {
                name: 'Customer 3',
                email: 'customer3@example.com'
              }
            }
          ]
        })
      });

      const result = await response.json();
      console.log('✅ Batch calls scheduled:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error scheduling batch calls:', error);
      throw error;
    }
  }

  /**
   * Prueba obtener estadísticas de llamadas
   */
  async testGetCallStats() {
    console.log('🧪 Testing call statistics...');
    
    try {
      const response = await fetch(`${this.serverUrl}/call-stats`);
      const stats = await response.json();
      
      console.log('✅ Call statistics:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting call stats:', error);
      throw error;
    }
  }

  /**
   * Prueba cancelar una llamada
   */
  async testCancelCall(callSid) {
    console.log(`🧪 Testing call cancellation for ${callSid}...`);
    
    try {
      const response = await fetch(`${this.serverUrl}/cancel-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callSid: callSid
        })
      });

      const result = await response.json();
      console.log('✅ Call canceled:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error canceling call:', error);
      throw error;
    }
  }

  /**
   * Prueba obtener detalles de una llamada
   */
  async testGetCallDetails(callSid) {
    console.log(`🧪 Testing call details for ${callSid}...`);
    
    try {
      const response = await fetch(`${this.serverUrl}/call-details/${callSid}`);
      const details = await response.json();
      
      console.log('✅ Call details:', details);
      return details;
      
    } catch (error) {
      console.error('❌ Error getting call details:', error);
      throw error;
    }
  }

  /**
   * Prueba el endpoint de salud del sistema
   */
  async testHealthCheck() {
    console.log('🧪 Testing health check...');
    
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      const health = await response.json();
      
      console.log('✅ Health check:', health);
      return health;
      
    } catch (error) {
      console.error('❌ Error in health check:', error);
      throw error;
    }
  }

  /**
   * Ejecuta todas las pruebas
   */
  async runAllTests() {
    console.log('🚀 Starting Outbound API Tests...\n');
    
    try {
      // 1. Health check
      await this.testHealthCheck();
      console.log('');
      
      // 2. Schedule single call
      const singleCallResult = await this.testScheduleSingleCall();
      console.log('');
      
      // 3. Schedule batch calls
      const batchResult = await this.testScheduleBatchCalls();
      console.log('');
      
      // 4. Get call stats
      await this.testGetCallStats();
      console.log('');
      
      // 5. Get call details (if we have a call SID)
      if (singleCallResult && singleCallResult.callSid) {
        await this.testGetCallDetails(singleCallResult.callSid);
        console.log('');
        
        // 6. Cancel call (optional - uncomment if you want to test cancellation)
        // await this.testCancelCall(singleCallResult.callSid);
        // console.log('');
      }
      
      console.log('🎉 All tests completed successfully!');
      
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Ejecuta una prueba específica
   */
  async runSpecificTest(testName) {
    console.log(`🧪 Running specific test: ${testName}`);
    
    switch (testName) {
      case 'health':
        await this.testHealthCheck();
        break;
      case 'single':
        await this.testScheduleSingleCall();
        break;
      case 'batch':
        await this.testScheduleBatchCalls();
        break;
      case 'stats':
        await this.testGetCallStats();
        break;
      case 'cancel':
        const callSid = process.argv[3];
        if (!callSid) {
          console.error('❌ Call SID required for cancel test');
          process.exit(1);
        }
        await this.testCancelCall(callSid);
        break;
      case 'details':
        const detailsCallSid = process.argv[3];
        if (!detailsCallSid) {
          console.error('❌ Call SID required for details test');
          process.exit(1);
        }
        await this.testGetCallDetails(detailsCallSid);
        break;
      default:
        console.error('❌ Unknown test:', testName);
        console.log('Available tests: health, single, batch, stats, cancel, details');
        process.exit(1);
    }
  }
}

// Ejecutar pruebas
async function main() {
  const tester = new OutboundTester();
  
  const testName = process.argv[2];
  
  if (testName) {
    await tester.runSpecificTest(testName);
  } else {
    await tester.runAllTests();
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OutboundTester }; 