const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

let dataStore;

// comment added here
exports.handler = async (event) => {
   if (event.context['http-method'] === 'DELETE') {
      dataStore = undefined;
   } else if (event.context['http-method'] === 'GET') {
   } else if (event.context['http-method'] === 'POST') {
      dataStore = event['body-json'];
   } else if (event.context['http-method'] === 'PUT') {
      dataStore = event['body-json'];
   }
   return { event, dataStore };
};
