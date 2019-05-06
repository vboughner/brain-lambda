'use strict';

// tests use this instead of db.js in order to mock the existence of the remote database,
// so that tests of the words searches, do not rely on it,
// there should be a function exported from this module that matches the signature
// of every function exported from the db.js module

// items in the database look like this:
// Item: {
//     UserId: userId,
//     DeviceId: deviceId,
//     WhenStored: when,
//     Text: text
// }

// this is an in-memory db that simply stores the items in an array, it is empty at first,
// but can be filled during the course of the test
let dbItems = [];


// load everything from memory in the db for this user,
// call the callback with the array of data items
function loadMemories(userId, deviceId, callback) {
    let result = [];
    for (let i = 0; i < dbItems.length; i++) {
        if (dbItems[i].UserId === userId) {
            result.push(dbItems[i]);
        }
    }
    callback(result);
}

// store a line of text in the db as another memory,
// call the callback when done, return true if successful, false if not successful
function storeMemory(userId, deviceId, text, callback) {
    let when = Date.now().toString();
    let item = {
        UserId: userId,
        DeviceId: deviceId,
        WhenStored: when,
        Text: text
    };
    dbItems.push(item);
    callback(true);
}

// remove one memory from the database, given the original item object made when recalling it,
// call the callback when done, return true if successful, false if not successful
function eraseOneMemory(item, callback) {
    for (let i = 0; i < dbItems.length; i++) {
        if (dbItems[i].UserId === item.UserId && dbItems[i].WhenStored === item.WhenStored) {
            dbItems.splice(i, 1);
            break;
        }
    }
    callback(true);
}

// remove all memories for a user from the database,
// call the callback when done, return true if successful, false if not successful
function eraseAllMemories(userId, deviceId, callback) {
    let result = [];
    for (let i = 0; i < dbItems.length; i++) {
        if (dbItems[i].UserId !== userId) {
            result.push(dbItems[i]);
        }
    }
    dbItems = result;
    callback(true);
}

// noinspection JSUnresolvedVariable
module.exports = {
    loadMemories: loadMemories,
    storeMemory: storeMemory,
    eraseOneMemory: eraseOneMemory,
    eraseAllMemories: eraseAllMemories
};
