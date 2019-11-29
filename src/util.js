'use strict'

// converts something like 'bixby-mobile-en-GB' to 'en-GB'
function convertCanTypeIdToLocaleName(canTypeId) {
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

// convert something like 'bixby-mobile-en-GB' to 'en'
function convertCanTypeIdToLanguageCode(canTypeId) {
    let languageCode = 'en'
    if (canTypeId) {
        const substrings = canTypeId.split('-')
        if (substrings.length === 1) {
            languageCode = substrings[0]
        } else {
            languageCode = substrings[substrings.length - 2]
        }
    }
    return languageCode
}

// noinspection JSUnresolvedVariable
module.exports = {
    convertCanTypeIdToLocaleName: convertCanTypeIdToLocaleName,
    convertCanTypeIdToLanguageCode: convertCanTypeIdToLanguageCode
}
