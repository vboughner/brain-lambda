'use strict';

const dbModule = require('./db');
const timeModule = require('./time');

// TODO: Bixby: most of this will be eliminated in favor of REST apis

// Commands for user to manipulate their stored memories

// this flags is false for now, because Alexa has a follow-on mode user could pick,
// but if you set it to true, Alexa will keep asking handling the first input after launch and help
const KEEP_ASKING = true;
const ASK_AFTER_HELP = true;

// how many memories to give at a time whenever a list is called for
const MEMORY_GROUP_SIZE = 5;

// alternative way to call the standard callback, one that checks for persistence
// and modifies the use of the callback, if we should persist after this command,
// do not call this when you are doing an "are you sure?" confirmation after a
// command request, because it also checks and clears any Command attribute, and
// that would cancel your command
function callbackWithPersistCheck(attributes, callback, response) {
    if (attributes && attributes.AfterNextCommand) {
        let followupAttributes = Object.assign({}, attributes);
        if (followupAttributes.Command) {
            delete followupAttributes.Command;
        }
        if (!followupAttributes.AfterNextCommand.Persistent) {
            delete followupAttributes.AfterNextCommand;
        }
        callback(response + '. ' + attributes.AfterNextCommand.Speak,
            attributes.AfterNextCommand.Listen, followupAttributes);
    }
    else {
        callback(response);
    }
}

// a method that can be used for any incomplete command,
// and useful as an example of what these command methods should look like
function stillWorkingOnIt(command, userId, deviceId, text, attributes, callback) {
    let response = 'you asked me to ' + command.Description +
        ', and I still need to learn how to do that';
    callbackWithPersistCheck(attributes, callback, response);
}

function howManyMemories(command, userId, deviceId, text, attributes, callback) {
    dbModule.loadMemories(userId, deviceId, (items) => {
        let response = 'There are ' + items.length + ' memories stored here';
        if (items.length === 0) {
            response = 'There are not any memories stored here yet';
        }
        else if (items.length === 1) {
            response = 'There is one memory stored here';
        }
        callbackWithPersistCheck(attributes, callback, response);
    });
}

function recallLastMemory(command, userId, deviceId, text, attributes, callback) {
    dbModule.loadMemories(userId, deviceId, (items) => {
        let response = '';
        if (items.length === 0) {
            response = 'you asked me to ' + command.Description + ', ' +
                'but there are no memories stored here yet';
        }
        else {
            let selectedMemory = items[items.length - 1];
            let howLongAgoText = timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored));
            response = 'you told me ' + howLongAgoText + ', ' + selectedMemory.Text;
        }
        callbackWithPersistCheck(attributes, callback, response);
    });
}

function recallAllMemories(command, userId, deviceId, text, attributes, callback) {
    // this function is both the primary first call for the command and also the
    // subsequent carry out function for recalling this command after a yes/no
    //
    // we have to reload all the memories again each time, because after 100 memories
    // there are too many to store in the session attributes (it caused a bug that broke
    // this command without much explanation, lambda message object payload limit is 6Kb
    dbModule.loadMemories(userId, deviceId, (items) => {
        // memoryIndex gets set to how many responses we have already heard
        let memoryIndex = (attributes.MemoryIndex) ? attributes.MemoryIndex : 0;
        let response = '';

        // first time we respond the memory index is at 0
        if (memoryIndex === 0) {
            if (items.length === 0) {
                response = 'There are no memories stored here yet. ';
            }
            else if (items.length === 1) {
                response = 'There is one memory stored here';
            }
            else {
                response = 'There are ' + items.length + ' memories stored here' +
                    ', I will list them from newest to oldest';
                if (items.length > MEMORY_GROUP_SIZE) {
                    response = response + ', in groups of ' + MEMORY_GROUP_SIZE;
                }
            }
        }
        else {
            // in later calls we continue with a different index
            response = 'Continuing';
        }

        if (items.length > memoryIndex) {
            let lastHowLongAgoText = '';
            for (let i = items.length - memoryIndex - 1; i >= 0 && i >= items.length - memoryIndex - MEMORY_GROUP_SIZE; i--) {
                response = response + '. ';
                let selectedMemory = items[i];
                let howLongAgoText = timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored));
                if (howLongAgoText !== lastHowLongAgoText) {
                    response = response + 'you told me ' + howLongAgoText + ', ';
                    lastHowLongAgoText = howLongAgoText;
                }
                response = response + selectedMemory.Text;
            }
        }

        if (items.length > memoryIndex + MEMORY_GROUP_SIZE) {
            response = response + '. would you like to hear more?';
            let reprompt = 'would you like to hear more? yes or no';
            let commandAttributes = Object.assign({}, attributes);
            commandAttributes.Command = command;
            commandAttributes.MemoryIndex = memoryIndex + MEMORY_GROUP_SIZE;
            callback(response, reprompt, commandAttributes);
        }
        else {
            response = response + '. that is all';
            callbackWithPersistCheck(attributes, callback, response);
        }
    });
}

function eraseLastMemory(command, userId, deviceId, text, attributes, callback) {
    dbModule.loadMemories(userId, deviceId, (items) => {
        let response = 'you asked me to ' + command.Description + ', ';
        if (items.length === 0) {
            response = response + 'but there are no memories stored here yet';
            callbackWithPersistCheck(attributes, callback, response);
        }
        else {
            let selectedMemory = items[items.length - 1];
            let howLongAgoText = timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored));
            response = response + 'you told me ' + howLongAgoText + ', ' + selectedMemory.Text + '. ';
            response = response + 'are you sure you want to erase that?';
            let reprompt = 'say yes to erase it';
            let commandAttributes = Object.assign({}, attributes);
            commandAttributes.Command = command;
            commandAttributes.Item = selectedMemory;
            callback(response, reprompt, commandAttributes);
        }
    });
}

// called after user has confirmed, attribute describe the previous requested command
function carryOutEraseLastMemory(command, userId, deviceId, text, attributes, callback) {
    if (attributes && attributes.Item) {
        let selectedMemory = attributes.Item;
        dbModule.eraseOneMemory(selectedMemory, (success) => {
            if (success) {
                callbackWithPersistCheck(attributes, callback, 'that memory has been erased');
            }
            else {
                callbackWithPersistCheck(attributes, callback, 'there was an error and that memory has not been erased');
            }
        });
    }
    else {
        console.log('error: no attribute for item found in command ' + attributes.Command.Id);
    }
}

function eraseAllMemories(command, userId, deviceId, text, attributes, callback) {
    dbModule.loadMemories(userId, deviceId, (items) => {
        let response = 'you asked me to ' + command.Description + ', ';
        if (items.length === 0) {
            response = response + 'but there are no memories stored here yet';
            callbackWithPersistCheck(attributes, callback, response);
        }
        else {
            if (items.length === 1) {
                response = response + 'There is one memory stored here. ';
                response = response + 'are you sure you want to erase that memory?';
            }
            else {
                response = response + 'There are ' + items.length + ' memories stored here. ';
                response = response + 'are you sure you want to erase all ' + items.length + ' memories?';
            }
            let reprompt = 'say yes to erase everything';
            let commandAttributes = Object.assign({}, attributes);
            commandAttributes.Command = command;
            callback(response, reprompt, commandAttributes);
        }
    });
}

// called after user has confirmed, attribute describe the previous requested command
function carryOutEraseAllMemories(command, userId, deviceId, text, attributes, callback) {
    dbModule.eraseAllMemories(userId, deviceId, (success) => {
        if (success) {
            callbackWithPersistCheck(attributes, callback, 'all memories have been erased');
        }
        else {
            callbackWithPersistCheck(attributes, callback, 'there was an error and the memories might not have been erased');
        }
    });
}

// given a list of memories, and the other typical information, returns a new modified version
// of the attributes that sets up a yes/no confirmation command for hearing more memories,
// useful when there are multiple answers to the same question
function getAttributesForHearMoreMemories(attributes, memories) {
    let commandAttributes = Object.assign({}, attributes);
    commandAttributes.Command = getCommandForId(HEAR_MORE_MEMORIES);
    commandAttributes.Memories = memories;
    return commandAttributes;
}

// let you hear more of the memories in a list, and sets up yes/no confirmation for hearing the rest
function carryOutHearMoreMemories(command, userId, deviceId, text, attributes, callback) {
    let response = '';
    let lastHowLongAgoText = '';
    let memories = attributes.Memories;

    for (let i = 0; i < MEMORY_GROUP_SIZE && i < memories.length; i++) {
        let selectedMemory = memories[i];
        let howLongAgoText = timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored));
        if (howLongAgoText !== lastHowLongAgoText) {
            response = response + 'you told me ' + howLongAgoText + ', ';
            lastHowLongAgoText = howLongAgoText;
        }
        response = response + selectedMemory.Text + '. ';
    }

    if (memories.length > MEMORY_GROUP_SIZE) {
        response = response + 'would you like to hear more?';
        let reprompt = 'would you like to hear more? yes or no';
        let responseAttributes = getAttributesForHearMoreMemories(attributes, memories.slice(MEMORY_GROUP_SIZE));
        callback(response, reprompt, responseAttributes);
    }
    else {
        let responseAttributes = Object.assign({}, attributes);
        delete responseAttributes.Command;
        delete responseAttributes.Memories;
        response = response + 'that is all';
        callbackWithPersistCheck(responseAttributes, callback, response);
    }
}

function getHelp(command, userId, deviceId, text, attributes, callback) {
    const appName = 'My Brain';
    const helpText =
        `${appName} can help you remember.
         Tell me something, and I'll remember it.
         Ask me a question, and I'll find the most recent thing you said about it.
         <break strength="x-strong"></break>
         Try something like,
         Alexa, tell ${appName} that my mothers birthday is april third.
         <break strength="x-strong"></break>
         After that, ask me a question, such as,
         Alexa, ask ${appName}, when is my mother's birthday?
         <break strength="x-strong"></break>
         Here is one more example.
         Alexa, tell ${appName} that I took my vitamins.
         Later, say, Alexa, ask My Brain, when did I take my vitamins?
         <break strength="x-strong"></break>
         I can go into a little more detail about how this works if you say, more help`;
    const helpPrompt =
        'Give it a try, tell me something to remember, or say more help';
    const helpReprompt =
        'Go ahead, say something you want me to remember, or say done';

    if (ASK_AFTER_HELP) {
        if (KEEP_ASKING) {
            const speakAfterNextStatement =
                'Now try asking a question about what you just said';
            const repromptAfterNextStatement =
                'Ask a question, or say done';
            const speakAfterNextQuestionOrCommand =
                'Tell me something you want me to remember';
            const repromptAfterNextQuestionOrCommand =
                'Say something you want me to remember, or say done';
            const helpAttributes = {
                AfterNextStatement: {
                    Speak: speakAfterNextStatement,
                    Listen: repromptAfterNextStatement,
                    Persistent: true
                },
                AfterNextQuestion: {
                    Speak: speakAfterNextQuestionOrCommand,
                    Listen: repromptAfterNextQuestionOrCommand,
                    Persistent: true
                },
                AfterNextCommand: {
                    Speak: speakAfterNextQuestionOrCommand,
                    Listen: repromptAfterNextQuestionOrCommand,
                    Persistent: true
                }
            };
            callback(helpText + '. ' + helpPrompt, helpReprompt, helpAttributes);
        }
        else {
            callback(helpText + '. ' + helpPrompt, helpReprompt);
        }
    }
    else {
        callback(helpText);
    }
}

function getAdvancedHelp(command, userId, deviceId, text, attributes, callback) {
    const advancedHelpText =
        `Here is more information about how I work.
         I recognize questions when you include a question word, such as who, when, or where.
         I will usually repeat back the last thing you said that has similar words,
         I simply search all memories for the words in your question.         
         And I always tell you the most recent thing you said about a topic.
         So if you need to change something, you can simply add a new memory, and it will take priority.
         <break strength="x-strong"></break>
         For example, Alexa, tell my brain that Fred's new phone number is 111-2222.
         <break strength="x-strong"></break>
         Next time you ask about Fred's phone number, you are going to get the newest number.
         <break strength="x-strong"></break>
         In addition to remembering for you, I can also help manage the growing list of memories.
         I know how to respond to certain questions or commands, such as,
         How many memories are there?
         What was the last thing I said?
         List all memories.
         Forget the last thing I said.
         Or, forget all memories.
         <break strength="x-strong"></break>
         Please know that I will always ask for confirmation, before I delete anything.
         Your memories are private, but only within your household. Anyone else talking to me from this location
         will be able to hear these memories, so keep that in mind.
         Thank you for letting me help you in some way`;

    callbackWithPersistCheck(attributes, callback, advancedHelpText);
}

function makeLaunch(command, userId, deviceId, text, attributes, callback) {
    const helloText = 'Say something you want me to remember, or ask a question';
    const helloReprompt = 'Say something to remember, ask a question, or say help';
    if (KEEP_ASKING) {
        const keepAskingText = 'Say something to remember, or ask a question';
        const keepAskingReprompt = 'Say something, ask a question, or say done';
        const launchAttributes = {
            AfterNextStatement: {
                Speak: keepAskingText,
                Listen: keepAskingReprompt,
                Persistent: true
            },
            AfterNextQuestion: {
                Speak: keepAskingText,
                Listen: keepAskingReprompt,
                Persistent: true
            },
            AfterNextCommand: {
                Speak: keepAskingText,
                Listen: keepAskingReprompt,
                Persistent: true
            }
        };
        callback(helloText, helloReprompt, launchAttributes);
    }
    else {
        callback(helloText, helloReprompt);
    }
}

function beDone(command, userId, deviceId, text, attributes, callback) {
    if (text === 'stop') {
        // stop should just immediately stop, without comment
        callback('');
    }
    else {
        callback('Okay.');
    }
}

function beUnhandled(command, userId, deviceId, text, attributes, callback) {
    const unhandledText = 'Sorry, I don\'t know how to handle that.';
    callback(unhandledText);
}

// a list of commands this skill can recognize (before analyzing for questions or statements),
// this looks a lot like the Alexa skill intents, but doing it this way gives us more control over
// exactly how phrases are matched, so that we can go on after this to look for questions and
// statements in the input instead, the Alexa skills matches are too generous sometimes
//
// the order of these commands matter, for example ADVANCED_HELP is before HELP to insure that
// advanced help will be given if the word 'more' or 'advanced' is found, and not just the word 'help'
//
// commands should be given in a format where the 'Samples' attribute gives possible strings to search for,
// and 'Description' can be used to read back the command to the user, after a phrase like "You asked me to..."
//
// [
//     {
//         Id: 'DELETE_LAST',
//         Description: 'delete the last memory',
//         Method: functionForHandlingIt,
//         CarryOutMethod: functionForAfterConfirmation,
//         Samples: [
//             'delete last item',
//             'delete last memory'
//         ]
//     },
//     <etc>
// ]
//
const RECALL_LAST = 'RECALL_LAST', CHANGE_LAST = 'CHANGE_LAST', ERASE_LAST = 'ERASE_LAST',
    ERASE_ALL = 'ERASE_ALL', HOW_MANY = 'HOW_MANY', RECALL_ALL = 'RECALL_ALL',
    HELP = 'HELP', ADVANCED_HELP = 'ADVANCED_HELP', MAKE_LAUNCH = 'MAKE_LAUNCH', DONE = 'DONE',
    HEAR_MORE_MEMORIES = 'HEAR_MORE_MEMORIES', UNHANDLED = 'UNHANDLED';

let commands = [
    {
        'Id': RECALL_LAST,
        'Description': 'recall the last memory',
        'Method': recallLastMemory,
        'Samples': [
            'recall last memory',
            'recall last item',
            'recall last thing',
            'recall what i just said',
            'remember last memory',
            'remember last item',
            'remember last thing',
            'remember what i just said',
            'what did i just say',
            'what i just said',
            'whats last thing',
            'what is last thing',
            'what was last thing',
            'what did you just memorize',
            'what is last thing you remember',
            'what is last memory',
            'what was last memory'
        ]
    },
    {
        'Id': CHANGE_LAST,
        'Description': 'change the last memory',
        'Method': stillWorkingOnIt,
        'Samples': [
            'change last memory',
            'change last item',
            'change last thing',
            'change what i just said'
        ]
    },
    {
        'Id': ERASE_LAST,
        'Description': 'forget the last memory',
        'Method': eraseLastMemory,
        'CarryOutMethod': carryOutEraseLastMemory,
        'Samples': [
            'delete last memory',
            'delete last item',
            'delete last thing',
            'delete what i just said',
            'remove last memory',
            'remove last item',
            'remove last thing',
            'remove what i just said',
            'erase last memory',
            'erase last item',
            'erase last thing',
            'erase what i just said',
            'forget last memory',
            'forget last item',
            'forget last thing',
            'forget what i just said',
        ]
    },
    {
        'Id': ERASE_ALL,
        'Description': 'forget all memories',
        'Method': eraseAllMemories,
        'CarryOutMethod': carryOutEraseAllMemories,
        'Samples': [
            'delete all memories',
            'delete all items',
            'delete all things',
            'delete everything',
            'remove all memories',
            'remove all items',
            'remove all things',
            'remove everything',
            'erase all memories',
            'erase all items',
            'erase all things',
            'erase everything',
            'forget all memories',
            'forget all items',
            'forget all things',
            'forget everything',
        ]
    },
    {
        'Id': HOW_MANY,
        'Description': 'tell you how many memories there are',
        'Method': howManyMemories,
        'Samples': [
            'how many memories',
            'how many items',
            'how many things'
        ]
    },
    {
        'Id': RECALL_ALL,
        'Description': 'recall all memories',
        'Method': recallAllMemories,
        'CarryOutMethod': recallAllMemories,
        'Samples': [
            'recall all memories',
            'remember all memories',
            'list all memories',
            'what are all things i said',
            'recall everything',
            'remember everything',
            'list everything',
            'what are all things',
            'what are all memories',
            'what are all items'
        ]
    },
    {
        'Id': ADVANCED_HELP,
        'Description': 'get advanced help',
        'Method': getAdvancedHelp,
        'Samples': [
            'more help',
            'advanced help',
            'get more help',
            'get advanced help',
            'get more information',
            'i want more help',
            'help me more',
            'how do you work'
        ]
    },
    {
        'Id': HELP,
        'Description': 'get help',
        'Method': getHelp,
        'Samples': [
            'help',
            'i want help',
            'get help',
            'help me'
        ]
    },
    {
        'Id': MAKE_LAUNCH,
        'Description': 'make launch request',
        'Method': makeLaunch,
        'Samples': [
            'launch request'
        ]
    },
    {
        'Id': DONE,
        'Description': 'done',
        'Method': beDone,
        'Samples': [
            'done',
            'quit',
            'stop',
            'cancel'
        ]
    },
    {
        'Id': HEAR_MORE_MEMORIES,
        'Description': 'hear more memories',
        'CarryOutMethod': carryOutHearMoreMemories
    },
    {
        'Id': UNHANDLED,
        'Description': 'unhandled intent',
        'Method': beUnhandled,
        'Samples': [
            'unhandled intent'
        ]
    }
];

// returns the command object for a command in the above list, given the Id,
// or null if it doesn't exist in the list
function getCommandForId(id) {
    for (let i = 0; i < commands.length; i++) {
        if (commands[i].Id === id) {
            return commands[i];
        }
    }
    return null;
}

// will be used in order, to trim words from the beginning of commands, order matters, as they will be
// tried in the order they appear here
let beginningCommandChatter = [
    'hello',
    'good morning',
    'good afternoon',
    'good evening',
    'please',
    'can you',
    'will you',
    'would you',
    'tell my brain',
    'ask my brain',
    'that',
    'to'
];

// phrases that should be removed from anywhere within the middle
let middleCommandChatter = [
    'the',
    'my',
    'your'
];

// phrases that should be trimmed from the end of a command, order matters, they will be tried in order
let endingCommandChatter = [
    'i said',
    'are there',
    'thank you'
];

// cuts away text before a command that doesn't matter, such as "will you" or "please can you",
// assumes text that is passed in is already all lower case
function cutCommandChatter(text) {
    let retval = text;
    for (let i = 0; i < beginningCommandChatter.length; i++) {
        if (retval.startsWith(beginningCommandChatter[i])) {
            retval = retval.substring(beginningCommandChatter[i].length);
            retval = retval.trim();
        }
    }
    for (let i = 0; i < middleCommandChatter.length; i++) {
        let index = retval.indexOf(middleCommandChatter[i]);
        while (index > -1) {
            // middle words need to have a space before and after them, or be at the beginning or end of string
            let charIndexBeforeChatter = index - 1;
            let charIndexAfterChatter = index + middleCommandChatter[i].length;
            if ((charIndexBeforeChatter < 0 || retval[charIndexBeforeChatter] === ' ') &&
                (charIndexAfterChatter === retval.length || retval[charIndexAfterChatter] === ' ')) {
                retval = retval.substring(0, index) +
                    retval.substring(index + middleCommandChatter[i].length).trim();
                retval = retval.trim();
                retval = retval.replace(/\s{2,}/g, ' ');  // removes extra spaces left in the middle after removals
            }
            index = retval.indexOf(middleCommandChatter[i], index + 1);
        }
    }
    for (let i = 0; i < endingCommandChatter.length; i++) {
        if (retval.endsWith(endingCommandChatter[i])) {
            retval = retval.substring(0, retval.length - endingCommandChatter[i].length);
            retval = retval.trim();
        }
    }
    return retval;
}

// searches through the command samples for a simple, perfect match,
// returns the command object that matches, or null if nothing matches well
function searchThruCommandsForString(commands, text) {
    let refinedText = cutCommandChatter(text);
    for (let i = 0; i < commands.length; i++) {
        if (commands[i].Samples) {
            for (let j = 0; j < commands[i].Samples.length; j++) {
                if (refinedText.indexOf(commands[i].Samples[j]) > -1) {
                    return commands[i];
                }
            }
        }
    }
    return null;
}

// returns false if the text is not a specific command, if the text is a command, it will respond
// to it my calling the callback, which is expected to receive one argument when there is simply
// something to say, and two argument when there is a question to ask (the second argument is the reprompt),
// and there may be a third argument, a furtherAction, and control will be passed to that action when
// a response comes back
function getResponseToCommand(userId, deviceId, text, attributes, callback) {
    let selectedCommand = searchThruCommandsForString(commands, text);
    if (selectedCommand && selectedCommand.Method) {
        selectedCommand.Method(selectedCommand, userId, deviceId, text, attributes, callback);
        return true;
    }
    else {
        return false;
    }
}

// carry out a previously defined command (this is coming back from a reprompt),
function carryOutPreviousCommand(userId, deviceId, text, attributes, callback) {
    if (attributes && attributes.Command) {
        // console.log('carry out previous command - attributes');
        // console.log(attributes);
        let commandId = attributes.Command.Id;
        let found = false;
        for (let i = 0; i < commands.length; i++) {
            if (commands[i].CarryOutMethod && commands[i].Id === commandId) {
                commands[i].CarryOutMethod(commands[i], userId, deviceId, text, attributes, callback);
                found = true;
                break;
            }
        }
        if (!found) {
            callback('the command to ' + attributes.Command.Description + ' is not one that requires confirmation');
        }
    }
    else {
        callback('i am not sure that command required confirmation');
    }
}

// cancel a previously defined command (this is coming back from a reprompt),
function cancelPreviousCommand(userId, deviceId, text, attributes, callback) {
    let response = 'Okay.';
    callback(response);
}

// noinspection JSUnresolvedVariable
module.exports = {
    getResponseToCommand: getResponseToCommand,
    carryOutPreviousCommand: carryOutPreviousCommand,
    cancelPreviousCommand: cancelPreviousCommand,
    getAttributesForHearMoreMemories: getAttributesForHearMoreMemories
};
