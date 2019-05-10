'use strict';

const wordModule = require('./word');
const commandModule = require('./command');
const searchModule = require('./search');
const dbModule = require('./db');
const timeModule = require('./time');

exports.handler = async (event) => {
    const userId = 'amzn1.ask.account.AG5EEHSAI6AZCQB67LMCVNNPQWF5HRK2H2BHPZQLW7LLRBKE5ZGPIA3OM6RIDYKOJHEO7O5G5YDFQHKXHCQ76CYA2G2P3DIU4PESC6TRUSN7QBSBSS2IBJ6PSKWY7NRZ6M6PFKM56VQ73LSZXXKJP3L27BYZ7JLDA24XRCDGWSKYLBEODZYHDYPAOFHQLUKJUQRGPIWSFRZ3T5Y';
    const deviceId = 'amzn1.ask.device.AGTSDQPG6KU7ICG5IFRYZXGVK6MGSSVEPGOWY5UQJRSIC63B46S6PZSAYANRECWK73GPHKMBM6TPAE6ZD5FXHUAZOZPCXFOLF2EGDUJRFJLKJC3E24DG53EVGPEK5QXNQ34MUU6IDQ7DAYL4QIPEVX3QOCEQ';
    const body = event['body-json'];
    let response;
    console.log('body-json', body);

    if (body.statement) {
        let cleanText = wordModule.cleanUpResponseText(body.statement);
        console.log('statement:', cleanText)

        const getResponseWithPromise = (userId, deviceId, inputText) => {
          return new Promise((resolve, reject) => {
            const attributes = {};
            const callback = (callbackResponse) => {
              resolve(callbackResponse);
            };
            getResponseToStatement(userId, deviceId, inputText, attributes, callback);
          });
        };

        const responseText = await getResponseWithPromise(userId, deviceId, cleanText);
        console.log('responseText was', responseText);
        response = {
            statusCode: 200,
            body: JSON.stringify(responseText),
        };
    } else if (body.question) {
        let cleanText = wordModule.cleanUpResponseText(body.question);
        console.log('qyestion:', cleanText)

        const getResponseWithPromise = (userId, deviceId, inputText) => {
          return new Promise((resolve, reject) => {
            const attributes = {};
            const callback = (callbackResponse) => {
              resolve(callbackResponse);
            };
            getResponseToQuestion(userId, deviceId, inputText, attributes, callback);
          });
        };

        const responseText = await getResponseWithPromise(userId, deviceId, cleanText);
        console.log('responseText was', responseText);
        response = {
            statusCode: 200,
            body: JSON.stringify(responseText),
        };
    } else {
        response = {
            statusCode: 200,
            body: JSON.stringify('that was neither a question nor a statement')
        };
    }
    return response;
};

exports.old_handler = async (event) => {
    const userId = 'amzn1.ask.account.AG5EEHSAI6AZCQB67LMCVNNPQWF5HRK2H2BHPZQLW7LLRBKE5ZGPIA3OM6RIDYKOJHEO7O5G5YDFQHKXHCQ76CYA2G2P3DIU4PESC6TRUSN7QBSBSS2IBJ6PSKWY7NRZ6M6PFKM56VQ73LSZXXKJP3L27BYZ7JLDA24XRCDGWSKYLBEODZYHDYPAOFHQLUKJUQRGPIWSFRZ3T5Y';
    const deviceId = 'amzn1.ask.device.AGTSDQPG6KU7ICG5IFRYZXGVK6MGSSVEPGOWY5UQJRSIC63B46S6PZSAYANRECWK73GPHKMBM6TPAE6ZD5FXHUAZOZPCXFOLF2EGDUJRFJLKJC3E24DG53EVGPEK5QXNQ34MUU6IDQ7DAYL4QIPEVX3QOCEQ';
    const text = 'when is Symons birthday?';
    let cleanText = wordModule.cleanUpResponseText(text);
    console.log('cleanedText is', cleanText)

    // the rest apis are going to come in already knowing if it is a question or not, so no need to worry
    // about that in here right now, there will be some REST apis

    const getResponseWithPromise = (userId, deviceId, inputText) => {
      return new Promise((resolve, reject) => {
        const attributes = {};
        const callback = (callbackResponse) => {
          resolve(callbackResponse);
        };
        getResponseToQuestion(userId, deviceId, inputText, attributes, callback);
      });
    };

    const responseText = await getResponseWithPromise(userId, deviceId, cleanText);
    console.log('responseText was', responseText);
    return {
      statusCode: 200,
      body: JSON.stringify(responseText),
    };
};

// returns null if the text is not a question, otherwise returns a response to the question,
// questions typically contain a question word, or are so short (2 words or less) that they
// could only be a question
function getResponseToQuestion(userId, deviceId, text, attributes, callback) {
    let responseAttributes = Object.assign({}, attributes);
    let refinedText = wordModule.cutQuestionChatter(text);
    let isReallyShort = wordModule.containsNumWordsOrLess(refinedText, 2);

    if (isReallyShort || wordModule.startsWithQuestionWord(refinedText)) {
        let response = isReallyShort ?
            'you asked me about ' + refinedText + '. ' :
            'you asked me ' + refinedText + '. ';
        let reprompt = '';

        dbModule.loadMemories(userId, deviceId, (recordedMemories) => {
            let bestMemories = selectBestMemoriesForQuestion(recordedMemories, refinedText);
            if (bestMemories) {
                let selectedMemory = bestMemories[0];
                let howLongAgoText = timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored));
                response = response + 'you told me ' + howLongAgoText + ', ' + selectedMemory.Text;
                if (bestMemories.length > 1) {
                    // there are multiple memories that match, put them in a play eventually loop
                    responseAttributes =
                        commandModule.getAttributesForHearMoreMemories(responseAttributes, bestMemories.slice(1));
                    response = response + ((bestMemories.length > 2) ?
                        '. there are ' + (bestMemories.length - 1) + ' more memories about this, ' :
                        '. there is one more memory about this, ');
                    response = response + 'would you like to hear more?';
                    reprompt = 'would you like to hear more?  yes or no';
                }
            }
            else {
                response = response + 'I don\'t have a memory that makes sense as an answer to that question.';
            }

            if (responseAttributes.Command) {
                callback(response, reprompt, responseAttributes);
            }
            else {
                if (responseAttributes.AfterNextQuestion) {
                    if (!responseAttributes.AfterNextQuestion.Persistent) {
                        delete responseAttributes.AfterNextQuestion;
                    }
                    callback(response + '. ' + attributes.AfterNextQuestion.Speak,
                        attributes.AfterNextQuestion.Listen, responseAttributes);
                }
                else {
                    callback(response);
                }
            }
        });
        return true;
    }
    else {
        return false;
    }
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

// return a response after storing information
function getResponseToStatement(userId, deviceId, text, attributes, callback) {
    let refinedText = wordModule.cutStatementChatter(text);
    if (refinedText) {
        dbModule.storeMemory(userId, deviceId, refinedText, (success) => {
            if (success) {
                if (attributes && attributes.AfterNextStatement) {
                    let followupAttributes = Object.assign({}, attributes);
                    if (!followupAttributes.AfterNextStatement.Persistent) {
                        delete followupAttributes.AfterNextStatement;
                    }
                    callback('I will remember that you said ' + refinedText +
                        '. ' + attributes.AfterNextStatement.Speak,
                        attributes.AfterNextStatement.Listen, followupAttributes);
                }
                else {
                    callback('I will remember that you said ' + refinedText);
                }
            }
            else {
                callback('I am sorry, I could not store that you said ' + refinedText);
            }
        });
    }
    else {
        callback('hmmm, I heard you say, ' + text + ', that didn\'t sound like a memory I could store');
    }
}

const handleCmdlineStatement = async (userId, deviceId, content) => {
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('statement:', cleanText);

    const getResponseWithPromise = (userId, deviceId, inputText) => {
        return new Promise((resolve, reject) => {
            const attributes = {};
            const callback = (callbackResponse) => {
                resolve(callbackResponse);
            };
            getResponseToStatement(userId, deviceId, inputText, attributes, callback);
        });
    };

    const responseText = await getResponseWithPromise(userId, deviceId, cleanText);
    console.log('response:', responseText);
    return responseText;
};

const handleCmdlineQuestion = async (userId, deviceId, content) => {
    let cleanText = wordModule.cleanUpResponseText(content);
    console.log('question:', cleanText);

    const getResponseWithPromise = (userId, deviceId, inputText) => {
        return new Promise((resolve, reject) => {
            const attributes = {};
            const callback = (callbackResponse) => {
                resolve(callbackResponse);
            };
            getResponseToQuestion(userId, deviceId, inputText, attributes, callback);
        });
    };

    const responseText = await getResponseWithPromise(userId, deviceId, cleanText);
    console.log('response:', responseText);
    return responseText;
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
