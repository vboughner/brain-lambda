'use strict';

const awsSDK = require('aws-sdk');
const docClient = new awsSDK.DynamoDB.DocumentClient({ region: 'us-east-1' });
const storeTable = 'MyBrainLines';
const maxBatchOperations = 25;    // you get an error with too many batch operations at once

// TODO: Bixby: most of this will be rewritten with promises

// NOTE: if you add a new exported function to this module, or change one of the existing
// function signatures, you should update the mock-db.js module as well

// load everything from memory in the db for this user,
// call the callback with the array of data items
function loadMemories(userId, deviceId, callback) {
    let params = {
        TableName: storeTable,
        KeyConditionExpression: '#user = :uId',
        ExpressionAttributeNames: {
            '#user': 'UserId'
        },
        ExpressionAttributeValues:  {
            ':uId': userId
        }
    };
    // console.log('DEBUG: reading with db params = ' + JSON.stringify(params));

    docClient.query(params, function(err, data) {
        if (err) {
            console.log('ERROR: problem in query operation = ' + JSON.stringify(err, null, 2));
            callback([]);
        }
        else {
            // console.log('DEBUG: returned from query operation = ' + JSON.stringify(data));
            // data.Items.forEach(function(item) {
            //     console.log(" -", item.Text);
            // });
            callback(data.Items);
        }
    });
}

// store a line of text in the db. call the callback when done, returns an object describing what was stored,
// or null if not successfully stored
function storeMemory(userId, deviceId, text, callback) {
    let when = Date.now().toString();
    let params = {
        TableName: storeTable,
        Item: {
            UserId: userId,
            DeviceId: deviceId,
            WhenStored: when,
            Text: text
        }
    };
    // console.log('DEBUG: storing with db params = ' + JSON.stringify(params));

    // noinspection JSUnusedLocalSymbols
    docClient.put(params, function(err, data) {
        if (err) {
            console.log('ERROR: problem in put operation = ' + JSON.stringify(err));
            callback(null);
        }
        else {
            callback(params.Item);
        }
    });
}

// remove one memory from the database, given the original item object made when recalling it,
// call the callback when done, return true if successful, false if not successful
function eraseOneMemory(item, callback) {
    let params = {
        TableName: storeTable,
        Key: {
            'UserId': item.UserId,
            'WhenStored': item.WhenStored
        },
    };
    // console.log('DEBUG: deleting with db params = ' + JSON.stringify(params));

    // noinspection JSUnusedLocalSymbols
    docClient.delete(params, function(err, data) {
        if (err) {
            console.log('ERROR: problem in delete operation = ' + JSON.stringify(err));
            callback(false);
        }
        else {
            // console.log('delete succeeded ', JSON.stringify(data, null, 2));
            callback(true);
        }
    });
}


// remove memories in this batch, starting at index, until they are all done,
// eventually calling the given callback method
function eraseMemoriesByBatch(batchItemArray, index, callback) {
    let partOfBatchItemArray = batchItemArray.slice(index, index + maxBatchOperations);
    let requestItems = {};
    requestItems[storeTable] = partOfBatchItemArray;
    let params = {
        RequestItems: requestItems
    };
    // console.log('DEBUG: batchWrite at index ' + index + ' with db params = ' + JSON.stringify(params));

    docClient.batchWrite(params, function(err, data) {
        if (err) {
            console.log('ERROR: problem in batchWrite operation = ' + JSON.stringify(err));
            callback(false);
        }
        else {
            // console.log('batchWrite at index ' + index + ' succeeded ', JSON.stringify(data, null, 2));

            if (data.UnprocessedItems && data.UnprocessedItems.length) {
                // TODO: add any data.UnprocessedItems back into the upcoming batches (it's a possible result of throttling)
                console.log('WARNING: need to add code to deal with unprocessed items: ' + JSON.stringify(data));
            }

            if (index + maxBatchOperations >= batchItemArray.length) {
                // we're done with all batches
                callback(true);
            }
            else {
                eraseMemoriesByBatch(batchItemArray, index + maxBatchOperations, callback);
            }
        }
    });
}

// remove all memories for a user from the database,
// call the callback when done, return true if successful, false if not successful
function eraseAllMemories(userId, deviceId, callback) {
    loadMemories(userId, deviceId, (items) => {
        let batchItemArray = [];
        for (let i = 0; i < items.length; i++) {
            let batchItem = {
                DeleteRequest: {
                    Key: {
                        'UserId': userId,
                        'WhenStored': items[i].WhenStored
                    }
                }
            };
            batchItemArray.push(batchItem);
        }
        eraseMemoriesByBatch(batchItemArray, 0, callback);
    });
}

// noinspection JSUnresolvedVariable
module.exports = {
    loadMemories: loadMemories,
    storeMemory: storeMemory,
    eraseOneMemory: eraseOneMemory,
    eraseAllMemories: eraseAllMemories
};
