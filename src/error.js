'use strict'

const UNSPECIFIED = 1000
const MISSING_BODY = 1001
const INCORRECT_CLIENT_VERSION = 1002
const INCORRECT_CLIENT_AUTH = 1003
const MISSING_USER_ID = 1004
const EMPTY_QUESTION = 1005
const MISSING_API_COMMAND = 1006
const MISSING_WHEN_STORED = 1007
const DELETE_ALL_FAILED = 1008
const DELETE_ONE_FAILED = 1009
const REPORT_FAILED = 1010
const REPORT_API_KEY_EXCEEDED = 1011
const MISSING_REPLACEMENT_TEXT = 1012

const MESSAGE = {
    [UNSPECIFIED]: 'error with no message yet defined',
    [MISSING_BODY]: 'missing body-json field',
    [INCORRECT_CLIENT_VERSION]: 'incorrect client version',
    [INCORRECT_CLIENT_AUTH]: 'incorrect client authentication',
    [MISSING_USER_ID]: 'missing userId',
    [EMPTY_QUESTION]: 'missing a complete response, maybe it was not a question',
    [MISSING_API_COMMAND]: 'missing actionType or a field that indicates which action to take',
    [MISSING_WHEN_STORED]: 'missing whenStored field to specify which memory',
    [DELETE_ALL_FAILED]: 'problem during delete all operation',
    [DELETE_ONE_FAILED]: 'problem during delete one operation',
    [REPORT_FAILED]: 'problem during report operation',
    [REPORT_API_KEY_EXCEEDED]: 'report api key permission limit exceeded',
    [MISSING_REPLACEMENT_TEXT]: 'missing or empty replacementText field when updating memory',
}

const getResponse = (errorCode = UNSPECIFIED, overrideErrorMessage = '') => {
    const errorMessage = overrideErrorMessage || MESSAGE[errorCode]
    const response = {
        statusCode: 400,
        body: {
            success: false,
            errorCode,
            errorMessage,
            englishDebug: errorMessage,
        },
    }
    console.log('Built Error Response:', response)
    return response
}

// noinspection JSUnresolvedVariable
module.exports = {
    UNSPECIFIED,
    MISSING_BODY,
    INCORRECT_CLIENT_VERSION,
    INCORRECT_CLIENT_AUTH,
    MISSING_USER_ID,
    EMPTY_QUESTION,
    MISSING_API_COMMAND,
    MISSING_WHEN_STORED,
    DELETE_ALL_FAILED,
    DELETE_ONE_FAILED,
    MESSAGE,
    REPORT_FAILED,
    REPORT_API_KEY_EXCEEDED,
    MISSING_REPLACEMENT_TEXT,
    getResponse,
}
