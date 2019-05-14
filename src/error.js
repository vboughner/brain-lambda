'use strict'

const UNSPECIFIED = 1000
const MISSING_BODY = 1001
const INCORRECT_CLIENT_VERSION = 1002
const INCORRECT_CLIENT_AUTH = 1003
const MISSING_USER_ID = 1004
const EMPTY_QUESTION = 1005
const MISSING_API_COMMAND = 1006

const MESSAGE = {
    [UNSPECIFIED]: 'error with no message yet defined',
    [MISSING_BODY]: 'missing body-json field',
    [INCORRECT_CLIENT_VERSION]: 'incorrect client version',
    [INCORRECT_CLIENT_AUTH]: 'incorrect client authentication',
    [MISSING_USER_ID]: 'missing userId',
    [EMPTY_QUESTION]: 'missing a complete response, maybe it was not a question',
    [MISSING_API_COMMAND]: 'missing a field that specifies which action to take',
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
  MESSAGE,
  getResponse,
}
