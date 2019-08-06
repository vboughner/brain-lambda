'use strict';

const semver = require('semver')
const wordModule = require('./word')
const searchModule = require('./search')
const dbModule = require('./db')
const timeModule = require('./time')
const error = require('./error.js')

const SECRET_CLIENT_API_KEY = process.env['SECRET_CLIENT_API_KEY']
const CLIENT_VERSION_SEMVER_SATISFIES = '1.x'
const SERVER_VERSION = '1.1.0'

exports.handler = async (event) => {
    const body = event['body-json']
    if (!body) {
        return error.getResponse(error.MISSING_BODY)
    }
    const request = {
        ...body,
        secretClientApiKey: 'redacted',
    }
    console.log('request:', JSON.stringify(request, null, 2))

    const clientVersion = body['clientVersion']
    if (!clientVersion || !semver.satisfies(clientVersion, CLIENT_VERSION_SEMVER_SATISFIES)) {
        return error.getResponse(error.INCORRECT_CLIENT_VERSION)
    }
    if (!SECRET_CLIENT_API_KEY || SECRET_CLIENT_API_KEY !== body['secretClientApiKey']) {
        return error.getResponse(error.INCORRECT_CLIENT_AUTH)
    }
    const userId = body['userId']
    if (!userId) {
        return error.getResponse(error.MISSING_USER_ID)
    }
    const myBrainUserId = await dbModule.getMyBrainUserId(userId);
    const deviceId = body['deviceId'] || body['deviceModel'] || 'unknown-device-id'
    console.log('myBrainUserId is', myBrainUserId, 'and deviceId is', deviceId)

    let response;
    if (body['statement']) {
        let cleanText = wordModule.cleanUpResponseText(body['statement'])
        const completeResponse = await getResponseToStatement(myBrainUserId, deviceId, cleanText)
        response = wrap(completeResponse)
    } else if (body['question']) {
        let cleanText = wordModule.cleanUpResponseText(body['question'])
        const completeResponse = await getResponseToQuestion(myBrainUserId, deviceId, cleanText)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.EMPTY_QUESTION)
    } else if (body['deleteAll']) {
        const completeResponse = await deleteAll(myBrainUserId, deviceId)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.DELETE_ALL_FAILED)
    } else if (body['deleteOne']) {
        const whenStored = body['whenStored']
        if (whenStored) {
            const completeResponse = await deleteOne(myBrainUserId, deviceId, whenStored)
            response = completeResponse ? wrap(completeResponse) : error.getResponse(error.DELETE_ONE_FAILED)
        } else {
            return error.getResponse(error.MISSING_WHEN_STORED)
        }
    } else if (body['list']) {
        const completeResponse = await getList(myBrainUserId, deviceId)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.UNSPECIFIED, 'problem with list')
    } else {
        response = error.getResponse(error.MISSING_API_COMMAND)
    }

    console.log('response:', JSON.stringify(response, null, 2))
    return response
};

// returns a response wrapped in a success code, if it was successful
function wrap(completeResponse) {
    if (completeResponse) {
        return {
            statusCode: 200,
            body: {
                ...completeResponse,
            },
        };
    }
    return completeResponse
}

// assumes the input is a question and returns a complete response to the question, with
// an object that contains all the possible responses, in order from best to worst (or
// an empty array of answers if there are no matches)
async function getResponseToQuestion(userId, deviceId, text) {
    let refinedText = wordModule.cutQuestionChatter(text);
    const recordedMemories = await dbModule.loadMemories(userId, deviceId);
    let bestMemories = selectBestMemoriesForQuestion(recordedMemories, refinedText);
    let response = {};
    response.answers = [];
    if (bestMemories && bestMemories.length > 0) {
        for (let i = 0; i < bestMemories.length; i++) {
            const selectedMemory = bestMemories[i];
            response.answers[i] = {
                text: selectedMemory.Text,
                whenStored: selectedMemory.WhenStored,
                userId: selectedMemory.UserId,
                deviceId: selectedMemory.DeviceId,
                score: selectedMemory.Score,
                howLongAgo: timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored)), // TODO: use locale
            };
        }
        response.success = true;
        response.speech = 'You told me ' + response.answers[0].howLongAgo + ': ' + response.answers[0].text + '.';
        response.serverVersion = SERVER_VERSION;
    }
    else {
        response.success = false;
        response.speech = 'I don\'t have a memory that makes sense as an answer for that.';
        response.serverVersion = SERVER_VERSION;
    }
    return response;
}

// select the memories that best match the question and returns an array of them,
// the best match is first in the returned array.
// returns null if there are no memories
function selectBestMemoriesForQuestion(memories, question) {
    if (memories && memories.length > 0) {
        // search for the right memory using words from the question
        let results = searchModule.searchThruDataForString(memories, question);

        if (results && results.length > 0) {
            return results;
        }
        else {
            return null;
        }
    }
    else {
        return null;
    }
}

// returns a response object that contains everything about a statement, after storing information
async function getResponseToStatement(userId, deviceId, text) {
    let refinedText = wordModule.cutStatementChatter(text);
    let response = {};
    if (refinedText) {
        const item = await dbModule.storeMemory(userId, deviceId, refinedText);
        if (item) {
            response.success = true;
            response.text = item.Text;
            response.whenStored = item.WhenStored;
            response.userId = item.UserId;
            response.deviceId = item.DeviceId;
            response.howLongAgo = timeModule.getHowLongAgoText(Number(item.WhenStored)); // TODO: use locale
            response.speech = 'I will remember that you said: ' + refinedText + '.';
            response.serverVersion = SERVER_VERSION;
        }
        else {
            response.success = false;
            response.speech = 'I am sorry, I had a connection problem and could not store what you said.';
            response.serverVersion = SERVER_VERSION;
        }
        return response;
    }
    else {
        response.success = false;
        response.speech = 'Hmmm, I heard you say, ' + text + ', but that didn\'t sound like a memory I could store.';
        response.serverVersion = SERVER_VERSION;
        return response;
    }
}

async function getList(userId, deviceId) {
    const recordedMemories = await dbModule.loadMemories(userId, deviceId);
    let response = {};
    response.answers = [];
    if (recordedMemories && recordedMemories.length > 0) {
        for (let i = recordedMemories.length - 1; i >= 0; i--) {
            const selectedMemory = recordedMemories[i];
            response.answers.push({
                text: selectedMemory.Text,
                whenStored: selectedMemory.WhenStored,
                userId: selectedMemory.UserId,
                deviceId: selectedMemory.DeviceId,
                score: selectedMemory.Score,
                howLongAgo: timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored)), // TODO: use locale
            });
        }
        response.success = true;
        response.speech = 'You have ' + response.answers.length + (response.answers.length > 1 ? ' memories.' : ' memory');
        response.serverVersion = SERVER_VERSION;
    }
    else {
        response.success = true;
        response.speech = 'There are no memories.';
        response.serverVersion = SERVER_VERSION;
    }
    return response;
}

async function deleteOne(userId, deviceId, whenStored) {
    const item = {
        UserId: userId,
        WhenStored: whenStored,
    }
    const success = await dbModule.eraseOneMemory(item);
    let response = {
        userId: userId,
        deviceId: deviceId,
        whenStored: whenStored,
    };
    if (success) {
        response.success = true;
        response.speech = 'I deleted that memory.';
    } else {
        response.success = false;
        response.speech = 'There was a problem and I could not delete that memory.';
    }
    response.serverVersion = SERVER_VERSION;
    return response;
}

async function deleteAll(userId, deviceId) {
    const success = await dbModule.eraseAllMemories(userId, deviceId);
    let response = {
        userId: userId,
        deviceId: deviceId,
    };
    if (success) {
        response.success = true;
        response.speech = 'I deleted all memories.';
    } else {
        response.success = false;
        response.speech = 'There was a problem and I could not delete all memories.';
    }
    response.serverVersion = SERVER_VERSION;
    return response;
}

const handleCmdlineStatement = async (userId, deviceId, content) => {
    const myBrainUserId = await dbModule.getMyBrainUserId(userId)
    console.log('userId', userId, ' -> myBrainUserId', myBrainUserId)
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('statement:', cleanText);
    const response = await getResponseToStatement(myBrainUserId, deviceId, cleanText);
    console.log('response:', response.speech);
    return response.speech;
};

const handleCmdlineQuestion = async (userId, deviceId, content) => {
    const myBrainUserId = await dbModule.getMyBrainUserId(userId)
    console.log('userId', userId, ' -> myBrainUserId', myBrainUserId)
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('question:', cleanText);
    const response = await getResponseToQuestion(myBrainUserId, deviceId, cleanText);
    console.log('response:', response.speech);
    return response.speech;
};

const handleCmdlineList = async (userId, deviceId) => {
    const myBrainUserId = await dbModule.getMyBrainUserId(userId)
    console.log('userId', userId, ' -> myBrainUserId', myBrainUserId)
    console.log('list');
    const response = await getList(myBrainUserId, deviceId);
    console.log('response:', response);
    return response;
};

const handleCmdlineDeleteOne = async (userId, deviceId, content) => {
    const myBrainUserId = await dbModule.getMyBrainUserId(userId)
    console.log('userId', userId, ' -> myBrainUserId', myBrainUserId)
    console.log('delete one:', content);
    const response = await deleteOne(myBrainUserId, deviceId, content);
    console.log('response:', response);
    return response;
}

const handleCmdlineDeleteAll = async (userId, deviceId) => {
    const myBrainUserId = await dbModule.getMyBrainUserId(userId)
    console.log('userId', userId, ' -> myBrainUserId', myBrainUserId)
    console.log('delete all');
    const response = await deleteAll(myBrainUserId, deviceId);
    console.log('response:', response);
    return response;
}

// command line tests use something like this:
//     node index.js statement 'my birthday is in january'
//     node index.js question 'my birthday'
//     node index.js delete
//
// the following bit of code should only run when we are NOT on the real lambda service
if (process && process.argv && process.argv[1] && process.argv[1].indexOf('src') !== -1) {
    const userId = 'test';
    const deviceId = 'cmdline';
    if (process.argv.length === 4) {
        const command = process.argv[2];
        const content = process.argv[3];
        if (command === 'statement') {
            handleCmdlineStatement(userId, deviceId, content);
            return 0;
        } else if (command === 'question') {
            handleCmdlineQuestion(userId, deviceId, content);
            return 0;
        } else if (command === 'deleteOne') {
            handleCmdlineDeleteOne(userId, deviceId, content);
            return 0;
        }
    } else if (process.argv.length === 3) {
        const command = process.argv[2];
        if (command === 'list') {
            handleCmdlineList(userId, deviceId);
            return 0;
        } else if (command === 'deleteAll') {
            handleCmdlineDeleteAll(userId, deviceId);
            return 0;
        }
    }

    console.log('usage: node index.js [statement|question|list|deleteAll] ["content"]');
    return 1;
}
