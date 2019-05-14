'use strict';

// clean up the text in the response before it is used for anything
function cleanUpResponseText(text) {
    return text.trim();
    // return stripPunctuation(text.toLowerCase());
};

// strip out punctuation and double-spaces (probably only important for command line testing,
// because does the skill's literal slot really ever return any punctuation?)
// thanks go to this stack overflow answer: https://stackoverflow.com/a/4328722/5828789
function stripPunctuation(text) {
    // noinspection RegExpRedundantEscape
    let withoutPunctuation = text.replace(/[\!\?.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    return withoutPunctuation.replace(/\s{2,}/g,' ');  // removes extra spaces left in after removals
}

// will be used in order, to trim words from the beginning of questions, order matters, as they will be
// tried in the order they appear here
let beginningQuestionChatter = [
    'hello',
    'good morning',
    'good afternoon',
    'good evening',
    'please',
    'can you',
    'will you',
    'would you',
    'say',
    'tell',
    'ask',
    'my brain',
    'to',
    'me',
    'us',
];

// phrases that should be trimmed from the end of a question, order matters, they will be tried in order
let endingQuestionChatter = [
    'thank you'
];

// cuts away text before a question that doesn't matter, such as "tell me" or "please tell me",
// assumes text that is passed in is already all lower case
function cutQuestionChatter(text) {
    let retval = text;
    for (let i = 0; i < beginningQuestionChatter.length; i++) {
        if (retval.startsWith(beginningQuestionChatter[i] + ' ')) {
            retval = retval.substring(beginningQuestionChatter[i].length);
            retval = retval.trim();
        }
    }
    for (let i = 0; i < endingQuestionChatter.length; i++) {
        if (retval.endsWith(' ' + endingQuestionChatter[i])) {
            retval = retval.substring(0, retval.length - endingQuestionChatter[i].length);
            retval = retval.trim();
        }
    }
    return retval;
}

function startsWithQuestionWord(text) {
    return (
        text.startsWith('who') ||
        text.startsWith('what') ||
        text.startsWith('when') ||
        text.startsWith('where') ||
        text.startsWith('why') ||
        text.startsWith('how') ||
        text.startsWith('about') ||
        text.startsWith('does') ||
        text.startsWith('do') ||
        text.startsWith('am') ||
        text.startsWith('are') ||
        text.startsWith('is') ||
        text.startsWith('has') ||
        text.startsWith('have') ||
        text.startsWith('did')
    );
}

// will be used in order, to trim words from the beginning of statements, order matters, as they will be
// tried in the order they appear here
let beginningStatementChatter = [
    'hello',
    'good morning',
    'good afternoon',
    'good evening',
    'please',
    'tell my brain',
    'tell me a brain',
    'ask my brain',
    'that',
    'to',
    'remember'
];

// phrases that should be trimmed from the end of a statement, order matters, they will be tried in order
let endingStatementChatter = [
    'thank you',
    'very much'
];

// cuts away text before a statement that doesn't matter, such as "tell me" or "please tell me",
// assumes text that is passed in is already all lower case
function cutStatementChatter(text) {
    let retval = text;
    for (let i = 0; i < beginningStatementChatter.length; i++) {
        if (retval.startsWith(beginningStatementChatter[i] + ' ')) {
            retval = retval.substring(beginningStatementChatter[i].length);
            retval = retval.trim();
        }
    }
    for (let i = 0; i < endingStatementChatter.length; i++) {
        if (retval.endsWith(' ' + endingStatementChatter[i])) {
            retval = retval.substring(0, retval.length - endingStatementChatter[i].length);
            retval = retval.trim();
        }
    }
    return retval;
}

function cutYesNoChatter(text) {
    return cutStatementChatter(text);
}

function containsNumWordsOrLess(text, numWords) {
    let words = text.split(' ');
    return words.length <= numWords;
}

// noinspection JSUnresolvedVariable
module.exports = {
    cleanUpResponseText: cleanUpResponseText,
    startsWithQuestionWord: startsWithQuestionWord,
    cutYesNoChatter: cutYesNoChatter,
    cutQuestionChatter: cutQuestionChatter,
    cutStatementChatter: cutStatementChatter,
    containsNumWordsOrLess: containsNumWordsOrLess
};
