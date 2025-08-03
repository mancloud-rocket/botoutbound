const twilio = require('twilio');
require('dotenv').config();

async function placeOrder(functionArgs) {
  const order = functionArgs.order;
  const number = functionArgs.number;
  console.log('GPT -> called placeOrder function: ', order);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);
  
  // generate a random order number that is 7 digits 
  const orderNum = Math.floor(Math.random() * (9999999 - 1000000 + 1) + 1000000);

  // await new Promise(resolve => setTimeout(resolve, 3000));
  
  try{
    // Send SMS using Twilio
    client.messages
      .create({
        body: `Your order number is ${orderNum}, and the details: ${order}`,
        from: process.env.FROM_NUMBER,
        to: number
      })
      .then(message => console.log(message.sid))
      .catch(err => console.error(err));

    // Send WhatsApp message with image
    await client.messages.create({
      body: `Your order number is ${orderNum}, and the details: ${order}`,
      mediaUrl:'https://dms.deckers.com/hoka/image/upload/f_auto,q_40,dpr_2/b_rgb:f7f7f9/w_483/v1703012492/1133957-BLCKB_6.png',
      from: `whatsapp:${process.env.FROM_NUMBER}`,
      to: `whatsapp:${number}`
    });  

    // Send WhatsApp message for feedback
    await client.messages.create({
      // body: `Your order number is ${orderNum}, and the details: ${order}`,
      contentSid:'HXb1d2e23a57adf705ea7b3fde126c04ab',
      from: `whatsapp:${process.env.FROM_NUMBER}`,
      to: `whatsapp:${number}`
    });  

    // Elimino: addEvent y comentarios relacionados con Segment
  }
  catch(err){
    console.log(err);
  }
  
  return JSON.stringify({ orderNumber: orderNum, message: 'the order is confirmed in the system.' });
}


module.exports = placeOrder;