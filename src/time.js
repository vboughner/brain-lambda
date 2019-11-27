'use strict'

const moment = require('moment')

// converts something like 'bixby-mobile-en-GB' to 'en-GB'
function convertCanTypeToLocaleName(canTypeId) {
    let localeName = 'en'
    if (canTypeId) {
        const substrings = canTypeId.split('-')
        if (substrings.length === 1) {
            localeName = substrings[0]
        } else {
            localeName = substrings.slice(-2).join('-')
        }
    }
    return localeName
}

// converts canTypeId to a locale name for moment and sets the global moment locale,
// use before returning any responses from getHowLongAgoText, returns the locale name
function setLocaleUsingCanType(canTypeId) {
    const localeName = convertCanTypeToLocaleName(canTypeId)
    moment.locale(localeName);
    return localeName
}

// returns how long ago the given timestamp occurred, e.g. '4 minutes ago'
function getHowLongAgoText(timestamp) {
    let howLongAgoText = moment(timestamp).fromNow();
    if (!howLongAgoText || howLongAgoText === 'Invalid date') {
        howLongAgoText = 'earlier'
    }
    return howLongAgoText
}

// noinspection JSUnresolvedVariable
module.exports = {
    setLocaleUsingCanType: setLocaleUsingCanType,
    getHowLongAgoText: getHowLongAgoText
}
