'use strict'

function getHelpText(canTypeId) {
    // TODO: differentiate help based on canTypeId (for language and/or customized by device)
    return `Tell me to remember something, and I'll remember it. ` +
        `Ask me a question that includes a few words from that memory, and I'll find it for you.`
}

// noinspection JSUnresolvedVariable
module.exports = {
    getHelpText: getHelpText,
};
