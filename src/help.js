'use strict';

function getHelpText() {
    const helpText =
        `Tell me to remember something, and I'll remember it.
         Ask me a question, and I'll find the most recent thing you said about it.
         I search all memories for the words in your question, and give you the most recent ones that match.
         Thanks for letting me help you in some way!`;
    return helpText;
}

// noinspection JSUnresolvedVariable
module.exports = {
    getHelpText: getHelpText,
};
