'use strict'

const awsSDK = require('aws-sdk')
const docClient = new awsSDK.DynamoDB.DocumentClient({ region: 'us-east-1' })
const storeTable = 'MyBrainLines'
const emailTable = 'MyBrainUserIds'
const reportTable = 'MyBrainReports'
const maxBatchOperations = 25 // you get an error with too many batch operations at once

// searches the MyBrainEmails table for an entry for the given assistantUserId, if one is
// found, it will return the myBrainUserId associated with that assistantUserId, and this
// new userId should be used in all further queries on the database, if an entry is not
// found, returns the original assistantUserId, which should be used instead
async function getMyBrainUserId(assistantUserId) {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: emailTable,
            KeyConditionExpression: '#user = :uId',
            ExpressionAttributeNames: {
                '#user': 'AssistantUserId'
            },
            ExpressionAttributeValues: {
                ':uId': assistantUserId
            }
        };
        // console.log('DEBUG: getting user id with db params = ' + JSON.stringify(params));

        docClient.query(params, function (err, data) {
            if (err) {
                console.log('ERROR: could not find myBrainUserId in query operation = ' + JSON.stringify(err, null, 2));
                resolve(assistantUserId);
            } else {
                // console.log('DEBUG: returned from query operation = ' + JSON.stringify(data));
                // data.Items.forEach(function(item) {
                //     console.log(" -", item.Text);
                // });
                resolve((data.Items && data.Items.length > 0) ? data.Items[0].BrainUserId : assistantUserId);
            }
        });
    });
}

// store a link so that a login with assistantUserId will be translated to myBrainUserId
// in future lookups, returns an object describing what was stored, or null if not successful
async function storeMyBrainUserId(assistantUserId, myBrainUserId, deviceId) {
    return new Promise((resolve, reject) => {
        let when = Date.now().toString();
        let params = {
            TableName: emailTable,
            Item: {
                AssistantUserId: assistantUserId,
                BrainUserId: myBrainUserId,
                DeviceId: deviceId,
                WhenUpdated: when,
            }
        };
        // console.log('DEBUG: storing with db params = ' + JSON.stringify(params));

        // noinspection JSUnusedLocalSymbols
        docClient.put(params, function (err, data) {
            if (err) {
                console.log('ERROR: problem in put operation = ' + JSON.stringify(err));
                resolve(null);
            } else {
                resolve(params.Item);
            }
        });
    });
}

// useful for user id migrations... given assistant user ids 1 and 2, will use whichever
// one is provided as an input for getMyBrainUserId while only one id is provided before or
// after the migration period. But when both ids are provided, it means that a migration
// from assistant user id 1 to 2 is going on, and it is important to establish a link
// during this period from the new id (assistantUserId2) to all records that are
// stored under the old id (assistantUserId1), and keep using the old id in the db
async function getMyBrainUserIdThruMigration(assistantUserId1, assistantUserId2, deviceId) {
    console.log('getMyBrainUserIdThruMigration: ', assistantUserId1, ' ==> ', assistantUserId2)
    if (assistantUserId1 && assistantUserId2) {
        const targetUserId = await getMyBrainUserId(assistantUserId2)
        if (targetUserId !== assistantUserId2) {
            // when the newer user id already has a lookup to something else, use it
            return new Promise((resolve, reject) => {
                resolve(targetUserId)
            })
        }
        // otherwise create a new lookup for linking new user id to old, and use it now too
        const stored = await storeMyBrainUserId(assistantUserId2, assistantUserId1, deviceId)
        return new Promise((resolve, reject) => {
            resolve(assistantUserId1)
        })
    } else if (assistantUserId1 || assistantUserId2) {
        return getMyBrainUserId(assistantUserId1 ? assistantUserId1 : assistantUserId2)
    } else {
        console.log('ERROR: neither user id has been provided in getMyBrainUserIdThruMigration')
        return new Promise((resolve, reject) => {
            resolve(null)
        })
    }
}

// load everything from memory in the db for this user, returns the array of data items
async function loadMemories(userId, deviceId) {
    return new Promise((resolve, reject) => {
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
                resolve([]);
            }
            else {
                // console.log('DEBUG: returned from query operation = ' + JSON.stringify(data));
                // data.Items.forEach(function(item) {
                //     console.log(" -", item.Text);
                // });
                resolve(data.Items);
            }
        });
    })
}

// store a line of text in the db, returns an object describing what was stored,
// or null if not successfully stored
async function storeMemory(userId, deviceId, canTypeId, timezone, storeCountry, text) {
    return new Promise((resolve, reject) => {
        let when = Date.now().toString();
        let params = {
            TableName: storeTable,
            Item: {
                UserId: userId,
                DeviceId: deviceId || 'unknown',
                WhenStored: when || 'unknown',
                CanTypeId: canTypeId || 'unknown',
                Timezone: timezone || 'unknown',
                StoreCountry: storeCountry || 'unknown',
                Text: text
            }
        };
        // console.log('DEBUG: storing with db params = ' + JSON.stringify(params));

        // noinspection JSUnusedLocalSymbols
        docClient.put(params, function (err, data) {
            if (err) {
                console.log('ERROR: problem in put operation = ' + JSON.stringify(err));
                resolve(null);
            } else {
                resolve(params.Item);
            }
        });
    });
}

// remove one memory from the database, given the original item object made when recalling it,
// return true if successful, false if not successful
async function eraseOneMemory(item) {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: storeTable,
            Key: {
                'UserId': item.UserId,
                'WhenStored': item.WhenStored.toString()
            },
        };
        // console.log('DEBUG: deleting with db params = ' + JSON.stringify(params));

        // noinspection JSUnusedLocalSymbols
        docClient.delete(params, function (err, data) {
            if (err) {
                console.log('ERROR: problem in delete operation = ' + JSON.stringify(err));
                resolve(false);
            } else {
                // console.log('delete succeeded ', JSON.stringify(data, null, 2));
                resolve(true);
            }
        });
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

// remove memories given in the batchItemArray, using batches, until they are all gone
async function eraseMemoriesByBatchWithPromise(batchItemArray) {
    return new Promise((resolve, reject) => {
        const callback = (callbackResponse) => {
            resolve(callbackResponse);
        };
        eraseMemoriesByBatch(batchItemArray, 0, callback);
    });
}

// remove all memories for a user from the database,
// call the callback when done, return true if successful, false if not successful
async function eraseAllMemories(userId, deviceId) {
    const items = await loadMemories(userId, deviceId);
    if (items && items.length > 0) {
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
        await eraseMemoriesByBatchWithPromise(batchItemArray);
    }
    return true;
}

// scans the table and loads EVERYTHING, should be used sparingly because it consumes resources,
// should be used for infrequently created reports (maybe daily), and not for routine user queries,
// returns an array of all rows, returns null when there is an error
async function loadEverything() {
    return new Promise((resolve, reject) => {
        let returnedRows = []
        let params = {
            TableName: storeTable,
        }

        // console.log('DEBUG: scanning with db params = ' + JSON.stringify(params, null, 2));
        docClient.scan(params, onScan)

        function onScan(err, data) {
            if (err) {
                console.log('ERROR: problem in scan operation = ' + JSON.stringify(err, null, 2));
                resolve(null)
            } else {
                // console.log('DEBUG: scan succeeded, num items was', data.Items.length)
                data.Items.forEach((memory) => returnedRows.push(memory))

                // continue scanning if we have more, each scan can retrieve a maximum of only 1MB of data
                if (typeof data.LastEvaluatedKey != "undefined") {
                    // console.log("DEBUG: scanning for more...")
                    params.ExclusiveStartKey = data.LastEvaluatedKey
                    docClient.scan(params, onScan)
                } else {
                    resolve(returnedRows)
                }
            }
        }
    })
}

// store a report to a row in the report db, returns an object describing what was stored,
// or null if not successfully stored
async function storeReport(userId, deviceId, serverVersion, report) {
    return new Promise((resolve, reject) => {
        let whenStored = Date.now().toString();
        let params = {
            TableName: reportTable,
            Item: {
                UserId: userId,
                WhenStored: whenStored,
                DeviceId: deviceId,
                ServerVersion: serverVersion,
                Report: report,
            }
        };
        // console.log('DEBUG: storing with db params = ' + JSON.stringify(params));

        // noinspection JSUnusedLocalSymbols
        docClient.put(params, function (err, data) {
            if (err) {
                console.log('ERROR: problem in put operation = ' + JSON.stringify(err));
                resolve(null);
            } else {
                resolve(params.Item);
            }
        });
    });
}

// noinspection JSUnresolvedVariable
module.exports = {
    getMyBrainUserIdThruMigration: getMyBrainUserIdThruMigration,
    loadMemories: loadMemories,
    storeMemory: storeMemory,
    eraseOneMemory: eraseOneMemory,
    eraseAllMemories: eraseAllMemories,
    loadEverything: loadEverything,
    storeReport: storeReport,
};
