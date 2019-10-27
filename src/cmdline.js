'use strict';

// the following bits of code only run when we are NOT on the lambda service,
// as this is the cmdline testing module, and it should NEVER be
// imported by index.js

const CMDLINE_CLIENT_VERSION = '1.2.0'
const CMDLINE_USER_ID = 'cmdline-user-id-001'
const CMDLINE_BIXBY_USER_ID = 'cmdline-bixby-user-id-001'
const CMDLINE_DEVICE_ID = 'cmdline-device-id-001'
const CMDLINE_CAN_TYPE_ID = 'bixby-mobile-en-US'
const CMDLINE_COUNTRY = 'US'

if (!process.env['SECRET_CLIENT_API_KEY']) {
    // this will override the key for local cmdline client requests only
    process.env['SECRET_CLIENT_API_KEY'] = 'cmdline-only'
}
const indexModule = require('./index')
const types = require('./types')

function figureParams(type, extraArgs) {
    let params
    switch(type) {
        case types.ACTION_TYPE_MEMORIZE:
            // expecting one parameter that is a statement
            if (extraArgs && extraArgs.length > 0) {
                params = { statement: extraArgs[0] }
            } else {
                console.error('Error: expected another argument: statement')
                process.exit(4);
            }
            break;

        case types.ACTION_TYPE_RECALL:
            // expecting one parameter that is a question
            if (extraArgs && extraArgs.length > 0) {
                params = { question: extraArgs[0] }
            } else {
                console.error('Error: expected another argument: question')
                process.exit(5);
            }
            break;

        case types.ACTION_TYPE_DELETE_ONE:
            // expecting one parameter that is a timestamp
            if (extraArgs && extraArgs.length > 0) {
                params = { whenStored: extraArgs[0] }
            } else {
                console.error('Error: expected another argument: whenStored')
                process.exit(6);
            }
            break;

        case types.ACTION_TYPE_LIST:
        case types.ACTION_TYPE_DELETE_ALL:
        case types.ACTION_TYPE_GET_REPORT:
        default:
            // none of these require a parameter
            params = {}
            break;
    }
    return params
}

async function makeRequest(type, params = {}) {
    const request = {
        "body-json": {
            actionType: type,
            clientVersion: CMDLINE_CLIENT_VERSION,
            secretClientApiKey: process.env['SECRET_CLIENT_API_KEY'],
            userId: CMDLINE_USER_ID,
            vivContext: {
                bixbyUserId: CMDLINE_BIXBY_USER_ID,
            },
            deviceId: CMDLINE_DEVICE_ID,
            canTypeId: CMDLINE_CAN_TYPE_ID,
            country:  CMDLINE_COUNTRY,
            ...params,
        }
    }
    return await indexModule.handler(request)
}

if (process && process.argv && process.argv[1] && process.argv[1].indexOf('src') !== -1) {
    // console.log('DEBUG: argv', process.argv)
    if (process.argv.length > 2) {
        const type = process.argv[2]
        if (types.VALID_TYPES.indexOf(type) > -1) {
            const params = figureParams(type, process.argv.slice(3))
            const response = makeRequest(type, params)
            if (response.error) {
                console.error('Error: problem with response')
                process.exit(3);
            }
        } else {
            console.error('Error: unrecognized type:', type)
            process.exit(2);
        }
    } else {
        console.log('usage: node cmdline.js list|memorize|recall|delete-all|delete-one|get-report args');
        process.exit(1);
    }
}
