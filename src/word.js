'use strict'

const util = require('./util')

// clean up the text in the response before it is used for anything, we no longer make it lower case here or
// cut out punctuation, because we want it stored as it appears (later when we are searching, we'll make some
// adjustments to the question search words, to make them all lower case and strip out punctuation)
function cleanUpResponseText(text) {
    return text.trim();
}

// will be used in order, to trim words from the beginning of questions, order matters, as they will be
// tried in the order they appear here
let beginningQuestionChatter = {
    'en': [
        'hello',
        'please',
        'can you',
        'say',
        'tell',
        'ask',
        'my brain',
        'to',
        'me',
    ],
    'es': [
        'hola',
        'por favor',
        'puedes',
        'dice',
        'mi cerebro',
        'a',
        'yo',
    ],
}

// phrases that should be trimmed from the end of a question, order matters, they will be tried in order
let endingQuestionChatter = {
    'en': [
        'thank you',
    ],
    'es': [
        'gracias',
    ],
};

// cuts away text before a question that doesn't matter, such as "tell me" or "please tell me",
// assumes text that is passed in is already all lower case
function cutQuestionChatter(canTypeId, text) {
    let cutText = text;
    const languageCode = util.convertCanTypeIdToLanguageCode(canTypeId)
    if (beginningQuestionChatter[languageCode] && endingQuestionChatter[languageCode]) {
        for (let i = 0; i < beginningQuestionChatter[languageCode].length; i++) {
            if (cutText.startsWith(beginningQuestionChatter[languageCode][i] + ' ')) {
                cutText = cutText.substring(beginningQuestionChatter[languageCode][i].length);
                cutText = cutText.trim();
            }
        }
        for (let i = 0; i < endingQuestionChatter[languageCode].length; i++) {
            if (cutText.endsWith(' ' + endingQuestionChatter[languageCode][i])) {
                cutText = cutText.substring(0, cutText.length - endingQuestionChatter[languageCode][i].length);
                cutText = cutText.trim();
            }
        }
    } else {
        console.warn(`cutQuestionChatter: no chatter arrays for language code '${languageCode}'`)
    }
    return cutText;
}

// will be used in order, to trim words from the beginning of statements, order matters, as they will be
// tried in the order they appear here
let beginningStatementChatter = {
    'en': [
        'hello',
        'please',
        'tell my brain',
        'tell me a brain',
        'ask my brain',
        'that',
        'to',
        'remember',
    ],
    'es': [
        'hola',
        'por favor',
        'dile a mi cerebro',
        'pregunta a mi cerebro',
        'a',
        'recuerda',
    ],
}

// phrases that should be trimmed from the end of a statement, order matters, they will be tried in order
let endingStatementChatter = {
    'en': [
        'thank you',
    ],
    'es': [
        'gracias',
    ],
}

// cuts away text before a statement that doesn't matter, such as "tell me" or "please tell me",
// assumes text that is passed in is already all lower case
function cutStatementChatter(canTypeId, text) {
    let cutText = text;
    const languageCode = util.convertCanTypeIdToLanguageCode(canTypeId)
    if (beginningStatementChatter[languageCode] && endingStatementChatter[languageCode]) {
        for (let i = 0; i < beginningStatementChatter[languageCode].length; i++) {
            if (cutText.startsWith(beginningStatementChatter[languageCode][i] + ' ')) {
                cutText = cutText.substring(beginningStatementChatter[languageCode][i].length);
                cutText = cutText.trim();
            }
        }
        for (let i = 0; i < endingStatementChatter[languageCode].length; i++) {
            if (cutText.endsWith(' ' + endingStatementChatter[languageCode][i])) {
                cutText = cutText.substring(0, cutText.length - endingStatementChatter[languageCode][i].length);
                cutText = cutText.trim();
            }
        }
    } else {
        console.warn(`cutStatementChatter: no chatter arrays for language code '${languageCode}'`)
    }
    return cutText;
}

// noinspection JSUnresolvedVariable
module.exports = {
    cleanUpResponseText: cleanUpResponseText,
    cutQuestionChatter: cutQuestionChatter,
    cutStatementChatter: cutStatementChatter,
};
