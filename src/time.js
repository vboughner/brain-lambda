'use strict';

const moment = require('moment');

// given a string of text, look for time units within it, and mark them so they
// will be said properly by Alexa in the coming response, for example, she needs
// to say 'a minute' as if that was a time unit, and not how big something is
// (this only happens when 'minute' is not preceded by a number, as in 'a minute ago')
function convertTextToSSML(text) {
    return text.replace(/\bminute\b/, '<w role="amazon:SENSE_1">minute</w>');
}

// returns how long ago the given timestamp occurred, e.g. '4 minutes ago'
function getHowLongAgoText(timestamp) {
    let howLongAgoText = moment(timestamp).fromNow();
    if (!howLongAgoText || howLongAgoText === 'Invalid date') {
        howLongAgoText = 'earlier';
    }
    return convertTextToSSML(howLongAgoText);
}

// noinspection JSUnresolvedVariable
module.exports = {
    getHowLongAgoText: getHowLongAgoText
};
