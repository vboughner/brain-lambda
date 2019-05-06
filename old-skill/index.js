'use strict';

const alexaSDK = require('alexa-sdk');
const wordModule = require('./word');
const commandModule = require('./command');
const searchModule = require('./search');
const dbModule = require('./db');
const timeModule = require('./time');

const handlers = {
    'LaunchRequest': function () {
        handleIntent.call(this, 'launch request');
    },
    'RawTextIntent': function () {
        // noinspection JSUnresolvedVariable
        handleIntent.call(this, this.event.request.intent.slots.rawtext.value);
    },
    'AMAZON.HelpIntent': function() {
        handleIntent.call(this, 'help');
    },
    'AMAZON.StopIntent': function() {
        handleIntent.call(this, 'stop');
    },
    'AMAZON.CancelIntent': function() {
        handleIntent.call(this, 'cancel');
    },
    'Unhandled': function() {
        handleIntent.call(this, 'unhandled intent');
    }
};

// noinspection JSUnresolvedVariable
module.exports = {
    handler: function (event, context) {
        console.log('DEBUG: this.event = ' + JSON.stringify(event));
        let alexa = alexaSDK.handler(event, context);

        // alexa-skill-test package does not want the appId set
        // noinspection JSUnresolvedVariable
        if ('undefined' === typeof process.env.DEBUG) {
            alexa.appId = 'amzn1.ask.skill.b26163dc-6310-494f-b4aa-529316fc58fe';
        }

        alexa.registerHandlers(handlers);
        alexa.execute();
    },
    getResponse: getResponse
};

// handles a single intent, given the text for the intent, make sure to bind 'this'
// to the same 'this' that the intent handler gets when it is called, using something like:
//         handleIntent.call(this, text)
function handleIntent(text) {
    const appName = 'My Brain';
    const userId = this.event.session.user.userId;
    const deviceId = this.event.context.System.device.deviceId;
    const attributes = this.event.session.attributes;
    getResponse(userId, deviceId, text, attributes, (response, reprompt, updatedAttributes) =>  {
        // note that even if the response is empty, we still need to respond or there will be an error
        // noinspection JSCheckFunctionSignatures
        this.response.speak(response);
        if (reprompt) {
            this.response._responseObject.sessionAttributes = updatedAttributes;
            this.response.listen(reprompt);
        }
        this.emit(':responseReady');
    });
}

// figure out if this is a question or a statement and return the appropriate response,
// the callback argument is expected to be a function that takes two arguments, like this:
//
//     function(response, reprompt, furtherAction) {
//         <speak the response>
//         <if there is a reprompt, listen for an answer>
//         <if there is a furtherAction, pass control to another action when response comes back>
//     }
//
function getResponse(userId, deviceId, text, attributes, callback) {
    let cleanText = wordModule.cleanUpResponseText(text);
    let wasYesNo = getResponseToYesOrNo(userId, deviceId, cleanText, attributes, callback);
    if (!wasYesNo) {
        let wasCommand = commandModule.getResponseToCommand(userId, deviceId, cleanText, attributes, callback);
        if (!wasCommand) {
            let wasQuestion = getResponseToQuestion(userId, deviceId, cleanText, attributes, callback);
            if (!wasQuestion) {
                getResponseToStatement(userId, deviceId, cleanText, attributes, callback);
            }
        }
    }
}

// returns true if the text is yes or no, handles the previous action being confirmed
function getResponseToYesOrNo(userId, deviceId, text, attributes, callback) {
    let refinedText = wordModule.cutYesNoChatter(text);
    if (refinedText === 'yes' || refinedText === 'sure' || refinedText === 'okay' || refinedText === 'ok') {
        if (attributes && attributes.Command) {
            commandModule.carryOutPreviousCommand(userId, deviceId, refinedText, attributes, callback);
        }
        else if (attributes && (attributes.AfterNextStatement || attributes.AfterNextQuestion)) {
            callback('Okay. ' + attributes.AfterNextStatement.Speak,
                attributes.AfterNextStatement.Listen, attributes);
        }
        else {
            callback('sorry, i don\'t know what you are saying yes to, could you start over?')
        }
        return true;
    }
    else if (refinedText === 'no' || refinedText === 'not really' ||
        refinedText === 'i know' || refinedText === 'nevermind' || refinedText === 'stop' ||
        refinedText === 'cancel' || refinedText === 'done') {
        if (attributes && attributes.Command) {
            commandModule.cancelPreviousCommand(userId, deviceId, refinedText, attributes, callback);
        }
        else if (attributes && (attributes.AfterNextStatement || attributes.AfterNextQuestion)) {
            callback('Okay.');
        }
        else {
            callback('sorry, i don\'t know what you are saying no to, could you start over?')
        }
        return true;
    }
    else if (attributes && attributes.Command) {
        callback('you asked me to ' + attributes.Command.Description +
            ', are you sure about that?  say yes or no.', 'please say yes or no', attributes);
        return true;
    }
    else if (refinedText === 'maybe') {
        if (attributes && (attributes.AfterNextStatement || attributes.AfterNextQuestion)) {
            callback('Hmmm. ' + attributes.AfterNextStatement.Speak,
                attributes.AfterNextStatement.Listen, attributes);
        }
        else {
            callback('sorry, i don\'t know what you are saying maybe to, could you start over?')
        }
        return true;
    }
    else {
        return false;
    }
}

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

// handles a single command line argument, will descend into another command line args if additional response needed
function handleCommandLineArg(argv, index, attributes) {
    if (argv && argv[index]) {
        console.log('input: ' + argv[index]);
        getResponse('cmdlineuser', 'cmdlinedevice', argv[index], attributes, (response, reprompt, updatedAttributes) => {
            console.log('response: ' + response);
            if (reprompt) {
                console.log('reprompt: ' + reprompt);
                // if (updatedAttributes) {
                //     console.log('updatedAttributes: ');
                //     console.log(updatedAttributes);
                // };
                if (argv.length > index + 1) {
                    handleCommandLineArg(argv, index + 1, updatedAttributes);
                }
            }
        });
    }
}

// plain command line manual tests use something like this to run this app:
//     node index.js 'this is a test string' 'further response if needed'
//
// the following bit of code should only run when:
//   - we are NOT in jasmine testing, and
//   - we are NOT on the real lambda service
// that leave plain old command line manual testing as the only time this runs
if (process && process.argv && process.argv[1].indexOf('jasmine') === -1) {
    if (!process.argv[2]) {
        // when nothing is given as manual test argument, just launch it
        process.argv[2] = 'make launch request';
    }
    handleCommandLineArg(process.argv, 2, {});
}
