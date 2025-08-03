require('colors');
const EventEmitter = require('events');
const fetch = require('node-fetch');
const tools = require('../functions/function-manifest');

const { prompt, userProfile, orderHistory } = require('./prompt');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};

tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
  console.log(`load function: ${functionName}`);
});


class GptService extends EventEmitter {
  constructor(model = 'gpt-4o') {
    super();
    this.model = model;  // Initialize model here
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://studio.rocketbot.com/webhook/e9e0142a7bdadfd9f3fbc32ac7cb2d77';
    this.userContext = [
      // { 'role': 'system', 'content': prompt },
      // { 'role': 'system', 'content': userProfile },
      // { 'role': 'system', 'content': 'You should speak English as default, and forget previous conversations' },
      { 'role': 'assistant', 'content': 'Hello! Welcome to Owl Shoes, how can i help you today' },
    ],
    this.partialResponseIndex = 0;
    this.isInterrupted = false;

    console.log(`GptService init with model: ${this.model} and N8N webhook: ${this.n8nWebhookUrl}`);
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallInfo (info, value) {
    console.log('setCallInfo', info, value);
    this.userContext.push({ 'role': 'user', 'content': `${info}: ${value}` });
  }

  interrupt () {
    this.isInterrupted = true;
  }

  validateFunctionArgs (args) {
    let argsArray = `[${args}]`
    try {
      return JSON.parse(argsArray);
    } catch (error) {
      // if we have two function calls we need to conver the string to an array of objects
      const regex = /\}(?!\s*,)(?=.*\})/g;
      argsArray = argsArray.replace(regex, '},')
      try {
        return JSON.parse(argsArray);
      } catch (error) {
        console.log("error parsing function arguments.")
        return null;
      }
    }
  }

  updateUserContext(name, role, text) {
    // console.log('updateUserContext: ', name, role, text)
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    console.log('GptService completion: ', role, name, text);
    this.isInterrupted = false;
    this.updateUserContext(name, role, text);

    try {
      // Send request to N8N webhook with simplified JSON
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentMessage: text,
          conversationHistory: this.userContext.map((ctx, index) => `${index + 1}. ${ctx.role}: ${ctx.content}`).join(' | '),
          lastUserMessage: this.userContext.find(ctx => ctx.role === 'user' && ctx.content)?.content || 'unknown',
          timestamp: new Date().toISOString(),
          interactionCount: interactionCount,
          totalMessages: this.userContext.length
        })
      });

      if (!response.ok) {
        throw new Error(`N8N webhook error: ${response.status}`);
      }

      // Handle different response formats from N8N
      let result;
      const contentType = response.headers.get('content-type');
      
      console.log('🔍 N8N Response Debug Info:');
      console.log('  📊 Status:', response.status);
      console.log('  📊 Content-Type:', contentType);
      console.log('  📊 Headers:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`    ${key}: ${value}`);
      }
      
      if (contentType && contentType.includes('application/json')) {
        console.log('  📝 Parsing as JSON...');
        result = await response.json();
        console.log('  ✅ JSON parsed successfully');
      } else {
        console.log('  📝 Content-Type not JSON, trying as text...');
        const textResponse = await response.text();
        console.log('  📄 Raw text response:', textResponse);
        console.log('  📄 Text length:', textResponse.length);
        
        try {
          result = JSON.parse(textResponse);
          console.log('  ✅ Text parsed as JSON successfully');
        } catch (parseError) {
          console.log('  ❌ Text is not valid JSON, treating as plain text');
          console.log('  ❌ Parse error:', parseError.message);
          result = { response: textResponse };
        }
      }
      
      // Handle the response from N8N
      await this.handleN8NResponse(result, interactionCount);

    } catch (error) {
      console.error('Error calling N8N webhook:', error);
      
      // Try to get more details about the error
      if (error.message.includes('encoding') || error.message.includes('hex')) {
        console.log('N8N encoding error detected, trying alternative approach...');
        
        // Try to get the response as text and parse manually
        try {
          const response = await fetch(this.n8nWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              currentMessage: text,
              conversationHistory: this.userContext.map((ctx, index) => `${index + 1}. ${ctx.role}: ${ctx.content}`).join(' | '),
              lastUserMessage: this.userContext.find(ctx => ctx.role === 'user' && ctx.content)?.content || 'unknown',
              timestamp: new Date().toISOString(),
              interactionCount: interactionCount,
              totalMessages: this.userContext.length
            })
          });
          
          const textResponse = await response.text();
          console.log('Raw response from N8N:', textResponse);
          
          // Try to extract JSON from the response
          const jsonMatch = textResponse.match(/\{.*\}/s);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            await this.handleN8NResponse(result, interactionCount);
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback approach also failed:', fallbackError);
        }
      }
      
      // Final fallback response
      this.emit('gptreply', 'I apologize, but I am having trouble processing your request right now. Please try again in a moment.', true, interactionCount);
    }
  }

  async handleN8NResponse(result, interactionCount) {
    console.log('🎯 N8N Response Processing:');
    console.log('  📦 Raw result type:', typeof result);
    console.log('  📦 Raw result:', JSON.stringify(result, null, 2));
    console.log('  🔢 Interaction count:', interactionCount);
    
    // Handle function calls if present
    if (result.tool_calls && result.tool_calls.length > 0) {
      await this.handleFunctionCalls(result.tool_calls, interactionCount);
      return;
    }

    // Handle different response formats from N8N
    let responseContent = null;
    
    console.log('🔍 Checking response format...');
    
    // Format 1: Standard OpenAI format
    if (result.content) {
      console.log('  ✅ Found OpenAI format (result.content)');
      responseContent = result.content;
    }
    // Format 2: N8N custom format with 'response' field
    else if (result.response) {
      console.log('  ✅ Found N8N custom format (result.response)');
      responseContent = result.response;
    }
    // Format 3: Direct string response
    else if (typeof result === 'string') {
      console.log('  ✅ Found direct string format');
      responseContent = result;
    }
    // Format 4: Check if there's a message field
    else if (result.message) {
      console.log('  ✅ Found message format (result.message)');
      responseContent = result.message;
    }
    else {
      console.log('  ❌ No recognized format found');
      console.log('  🔍 Available keys:', Object.keys(result));
    }

    if (responseContent) {
      // Simulate streaming by sending the response in chunks
      await this.simulateStreaming(responseContent, interactionCount);
      this.userContext.push({'role': 'assistant', 'content': responseContent});
      
      // Log additional fields if present
      if (result.intent) {
        console.log('Intent detected:', result.intent);
      }
      if (result.email) {
        console.log('Email field:', result.email);
      }
      if (result.name) {
        console.log('Name field:', result.name);
      }
    } else {
      console.error('No valid response content found in N8N response:', result);
      // Fallback response
      this.emit('gptreply', 'I apologize, but I received an unexpected response format. Please try again.', true, interactionCount);
    }

    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }

  async simulateStreaming(fullResponse, interactionCount) {
    // Split response into words for simulated streaming
    const words = fullResponse.split(' ');
    let partialResponse = '';
    
    for (let i = 0; i < words.length; i++) {
      if (this.isInterrupted) break;
      
      partialResponse += words[i] + ' ';
      
      // Send chunk every 4-5 words to simulate streaming
      if (i % 4 === 0 || i === words.length - 1) {
        const isLast = i === words.length - 1;
        this.emit('gptreply', partialResponse.trim(), isLast, interactionCount);
        partialResponse = '';
        
        // Small delay to simulate real streaming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async handleFunctionCalls(toolCalls, interactionCount) {
    for (const toolCall of toolCalls) {
      if (toolCall.function) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;
        
        const functionToCall = availableFunctions[functionName];
        if (!functionToCall) {
          console.error(`Function ${functionName} not found`);
          continue;
        }

        console.log('Calling function:', functionName, 'with args:', functionArgs);
        
        // Say a pre-configured message from the function manifest
        const toolData = tools.find(tool => tool.function.name === functionName);
        const say = toolData.function.say;
        this.emit('gptreply', say, false, interactionCount);
        
        let functionResponse;
        try {
          // Parse function arguments
          const args = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs;
          functionResponse = await functionToCall(args);
        } catch (error) {
          console.error(`Error executing function ${functionName}:`, error);
          functionResponse = `Error executing ${functionName}: ${error.message}`;
        }
        
        this.emit('tools', functionName, functionArgs, functionResponse);
        
        // Send the function response back to N8N for further processing
        this.updateUserContext(functionName, 'function', functionResponse);
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      }
    }
  }
}

module.exports = { GptService };
