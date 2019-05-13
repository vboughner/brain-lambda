'use strict';

const wordModule = require('./word');
const searchModule = require('./search');
const dbModule = require('./db');
const timeModule = require('./time');

const SECRET_CLIENT_API_KEY = process.env['SECRET_CLIENT_API_KEY'];

exports.handler = async (event) => {
    const body = event['body-json'];
    let response;

    if (body) {
        if (SECRET_CLIENT_API_KEY && SECRET_CLIENT_API_KEY === body['secretClientApiKey']) {
            const userId = body.userId;
            const deviceId = body.deviceId || 'unknown-device-id';
            if (userId) {
                if (body['statement']) {
                    let cleanText = wordModule.cleanUpResponseText(body['statement']);
                    const completeResponse = await getStatementResponseWithPromise(userId, deviceId, cleanText);
                    console.log('statement:', cleanText)
                    console.log('completeResponse:', completeResponse)
                    response = {
                        statusCode: 200,
                        body: {
                            ...completeResponse,
                        },
                    };
                } else if (body['question']) {
                    let cleanText = wordModule.cleanUpResponseText(body['question']);
                    const completeResponse = await getQuestionResponseWithPromise(userId, deviceId, cleanText);
                    console.log('question:', cleanText)
                    if (completeResponse) {
                        console.log('completeResponse:', completeResponse)
                        response = {
                            statusCode: 200,
                            body: {
                                ...completeResponse,
                            },
                        };
                    } else {
                        response = {
                            statusCode: 200,
                            body: {
                                answer: 'missing a complete response, maybe it was not a question',
                            },
                        };
                    }
                } else {
                    response = {
                        statusCode: 200,
                        body: {
                            answer: 'missing both question or statement fields, need one',
                        },
                    };
                }
            } else {
                response = {
                    statusCode: 200,
                    body: {
                        answer: 'missing userId field',
                    },
                };
            }
        } else {
            response = {
                statusCode: 200,
                body: {
                    answer: 'incorrect secretClientApiKey field',
                }
            };
        }
    } else {
        response = {
            statusCode: 200,
            body: {
                answer: 'missing body-json field',
            }
        };
    }

    return response;
};

const getQuestionResponseWithPromise = (userId, deviceId, inputText) => {
    return new Promise((resolve, reject) => {
        const attributes = {};
        const callback = (callbackResponse) => {
            resolve(callbackResponse);
        };
        getResponseToQuestion(userId, deviceId, inputText, attributes, callback);
    });
};

// assumes the input is a question and returns a complete response to the question, with
// an object that contains all the possible responses, in order from best to worst (or
// an empty array of answers if there are no matches)
// TODO: move compilation of response into the capsule, englishDebug is only for debugging
function getResponseToQuestion(userId, deviceId, text, attributes, callback) {
    let refinedText = wordModule.cutQuestionChatter(text);

    dbModule.loadMemories(userId, deviceId, (recordedMemories) => {
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
                    howLongAgo: timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored)), // TODO: move to capsule
                };
            }
            response.success = true;
            response.englishDebug = 'You told me ' + response.answers[0].howLongAgo + ', "' + response.answers[0].text + '"';
        }
        else {
            response.success = false;
            response.englishDebug = 'I don\'t have a memory that makes sense as an answer to that question.';
        }
        console.log('question response', response);
        callback(response);
    });
}

// select the memories that best match the question and returns an array of them,
// the best match is first in the returned array.
// returns null if there are no memories
function selectBestMemoriesForQuestion(memories, question) {
    if (memories && memories.length > 0) {
        // search for the right memory using words from the question
        let results = searchModule.searchThruDataForString(memories, question);
        // console.log('RESULTS\n', results);

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

const getStatementResponseWithPromise = (userId, deviceId, inputText) => {
    return new Promise((resolve, reject) => {
        const attributes = {};
        const callback = (callbackResponse) => {
            resolve(callbackResponse);
        };
        getResponseToStatement(userId, deviceId, inputText, attributes, callback);
    });
};

// return a response object that contains everything about a state,
// after storing information
// TODO: move compilation of response into the capsule, englishDebug is only for debugging
function getResponseToStatement(userId, deviceId, text, attributes, callback) {
    let refinedText = wordModule.cutStatementChatter(text);
    let response = {};
    if (refinedText) {
        dbModule.storeMemory(userId, deviceId, refinedText, (item) => {
            if (item) {
                response.success = true;
                response.text = item.Text;
                response.whenStored = item.WhenStored;
                response.userId = item.UserId;
                response.deviceId = item.DeviceId;
                response.englishDebug = 'I will remember that you said "' + refinedText + '".';
            }
            else {
                response.success = false;
                response.englishDebug = 'I am sorry, I could not store that you said "' + refinedText + '".';
            }
            console.log('statement response', response);
            callback(response);
        });
    }
    else {
        response.success = false;
        response.englishDebug = 'Hmmm, I heard you say, ' + text + ', that didn\'t sound like a memory I could store.';
        console.log('statement response', response);
        callback(response);
    }
}

const handleCmdlineStatement = async (userId, deviceId, content) => {
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('statement:', cleanText);
    const response = await getStatementResponseWithPromise(userId, deviceId, cleanText);
    console.log('response:', response.englishDebug);
    return response.englishDebug;
};

const handleCmdlineQuestion = async (userId, deviceId, content) => {
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('question:', cleanText);
    const response = await getQuestionResponseWithPromise(userId, deviceId, cleanText);
    console.log('response:', response.englishDebug);
    return response.englishDebug;
};

// command line tests use something like this:
//     node index.js statement 'my birthday is in january'
//     node index.js question 'my birthday'
//     node index.js delete
//
// the following bit of code should only run when we are NOT on the real lambda service
if (process && process.argv && process.argv[1] && process.argv[1].indexOf('src') !== -1) {
    // console.log('argv', process.argv);
    if (process.argv.length === 4) {
        const userId = 'amzn1.ask.account.AG5EEHSAI6AZCQB67LMCVNNPQWF5HRK2H2BHPZQLW7LLRBKE5ZGPIA3OM6RIDYKOJHEO7O5G5YDFQHKXHCQ76CYA2G2P3DIU4PESC6TRUSN7QBSBSS2IBJ6PSKWY7NRZ6M6PFKM56VQ73LSZXXKJP3L27BYZ7JLDA24XRCDGWSKYLBEODZYHDYPAOFHQLUKJUQRGPIWSFRZ3T5Y';
        const deviceId = 'amzn1.ask.device.AGTSDQPG6KU7ICG5IFRYZXGVK6MGSSVEPGOWY5UQJRSIC63B46S6PZSAYANRECWK73GPHKMBM6TPAE6ZD5FXHUAZOZPCXFOLF2EGDUJRFJLKJC3E24DG53EVGPEK5QXNQ34MUU6IDQ7DAYL4QIPEVX3QOCEQ';
        const command = process.argv[2];
        const content = process.argv[3];
        if (command === 'statement') {
            handleCmdlineStatement(userId, deviceId, content);
            return 0;
        } else if (command === 'question') {
            handleCmdlineQuestion(userId, deviceId, content);
            return 0;
        }
    }
    console.log('usage: node index.js [statement|question] "content"');
    return 1;
}
