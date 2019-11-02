'use strict'

const semver = require('semver')
const wordModule = require('./word')
const searchModule = require('./search')
const reportModule = require('./report')
const helpModule = require('./help')
const dbModule = require('./db')
const timeModule = require('./time')
const types = require('./types')
const error = require('./error.js')

const SECRET_CLIENT_API_KEY = process.env['SECRET_CLIENT_API_KEY']
const REPORT_GENERATION_API_KEY = process.env['REPORT_GENERATION_API_KEY']
const ACCESS_LEVEL_SECRETS = 'all-secrets'
const ACCESS_LEVEL_REPORTS = 'reports-only'
const ACCESS_LEVEL_NONE = 'none'

const CLIENT_VERSION_SEMVER_SATISFIES = '1.x'
const SERVER_VERSION = '1.4.0'

exports.handler = async (event) => {
    const body = event['body-json']
    if (!body) {
        return error.getResponse(error.MISSING_BODY)
    }
    logRequest(body)

    const clientVersion = body['clientVersion']
    if (!clientVersion || !semver.satisfies(clientVersion, CLIENT_VERSION_SEMVER_SATISFIES)) {
        return error.getResponse(error.INCORRECT_CLIENT_VERSION)
    }

    const accessLevel = determineAccessLevel(body)
    console.log('access level is', accessLevel)
    if (accessLevel === ACCESS_LEVEL_NONE) {
        return error.getResponse(error.INCORRECT_CLIENT_AUTH)
    }

    // note: we still need to look for certain fields outside of vivContext, for older clients (< v1.3.0)
    const userId = body['vivContext'] ? body['vivContext']['userId'] : body['userId']
    const bixbyUserId = body['vivContext'] ? body['vivContext']['bixbyUserId'] : null
    if (!userId && !bixbyUserId) {
        return error.getResponse(error.MISSING_USER_ID)
    }
    // note: we still need to look for certain fields outside of vivContext, for older clients (< v1.3.0)
    const deviceId = body['deviceId'] || body['deviceModel'] || (body['vivContext'] ? body['vivContext']['deviceModel'] : null) || 'unknown-device-id'
    const myBrainUserId = await dbModule.getMyBrainUserIdThruMigration(userId, bixbyUserId, deviceId)
    console.log('myBrainUserId is', myBrainUserId)
    if (!myBrainUserId) {
        return error.getResponse(error.MISSING_USER_ID)
    }

    if (accessLevel === ACCESS_LEVEL_SECRETS) {
        return await allSecretsAccessHandler(myBrainUserId, deviceId, body)
    }
    if (accessLevel === ACCESS_LEVEL_REPORTS) {
        return await reportsOnlyAccessHandler(myBrainUserId, deviceId, body)
    }
    return error.getResponse(error.UNSPECIFIED, 'unknown access level')
}

const logRequest = (request) => {
    const redactedRequest = {
        ...request,
        reportGenerationApiKey: request.reportGenerationApiKey ? 'redacted' : undefined,
        secretClientApiKey: request.secretClientApiKey ? 'redacted' : undefined,
    }
    console.log('redacted request:', JSON.stringify(redactedRequest, null, 2))
}

const determineAccessLevel = (request) => {
    if (SECRET_CLIENT_API_KEY && SECRET_CLIENT_API_KEY === request['secretClientApiKey']) {
        return ACCESS_LEVEL_SECRETS
    }
    if (REPORT_GENERATION_API_KEY && REPORT_GENERATION_API_KEY === request['reportGenerationApiKey']) {
        return ACCESS_LEVEL_REPORTS
    }
    return ACCESS_LEVEL_NONE
}

const allSecretsAccessHandler = async (userId, deviceId, request) => {
    let response
    const actionType = request['actionType'] || 'unknown-action-type'
    // note: we still need the request field checks, because ACTION_TYPE is not used by older clients (< v1.2.0)
    if (actionType === types.ACTION_TYPE_MEMORIZE || request['statement']) {
        const { statement } = request
        // note: we still need to look for certain fields outside of vivContext, for older clients (< v1.3.0)
        const { canTypeId, timezone, storeCountry } = request['vivContext'] || request
        let cleanText = wordModule.cleanUpResponseText(statement)
        const completeResponse = await memorizeStatement(userId, deviceId, canTypeId, timezone, storeCountry, cleanText)
        response = wrap(completeResponse)
    } else if (actionType === types.ACTION_TYPE_RECALL || request['question']) {
        let cleanText = wordModule.cleanUpResponseText(request['question'])
        const completeResponse = await recallForQuestion(userId, deviceId, cleanText)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.EMPTY_QUESTION)
    } else if (actionType === types.ACTION_TYPE_LIST || request['list']) {
        const completeResponse = await getList(userId, deviceId)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.UNSPECIFIED, 'problem with list')
    } else if (actionType === types.ACTION_TYPE_DELETE_ALL || request['deleteAll']) {
        const completeResponse = await deleteAll(userId, deviceId)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.DELETE_ALL_FAILED)
    } else if (actionType === types.ACTION_TYPE_DELETE_ONE || request['deleteOne']) {
        const whenStored = request['whenStored']
        if (whenStored) {
            const completeResponse = await deleteOne(userId, deviceId, whenStored)
            response = completeResponse ? wrap(completeResponse) : error.getResponse(error.DELETE_ONE_FAILED)
        } else {
            return error.getResponse(error.MISSING_WHEN_STORED)
        }
    } else if (actionType === types.ACTION_TYPE_GET_REPORT) {
        const completeResponse = await getReport(userId, deviceId)
        response = completeResponse ? wrap(completeResponse) : error.getResponse(error.UNSPECIFIED, 'problem with report')
    } else if (actionType === types.ACTION_TYPE_HELP) {
        // note: we still need to look for certain fields outside of vivContext, for older clients (< v1.3.0)
        const { canTypeId } = request['vivContext'] || request
        response = wrap(getHelp(canTypeId))
    } else {
        response = error.getResponse(error.MISSING_API_COMMAND)
    }

    console.log('response:', JSON.stringify(response, null, 2))
    return response
}

const reportsOnlyAccessHandler = async (userId, deviceId, request) => {
    const actionType = request['actionType'] || 'unknown-action-type'
    if (actionType === types.ACTION_TYPE_GET_REPORT) {
        const completeResponse = await getReport(userId, deviceId)
        const response = completeResponse ? wrap(completeResponse) : error.getResponse(error.UNSPECIFIED, 'problem with report')
        console.log('response:', JSON.stringify(response, null, 2))
        return response
    }
    return error.getResponse(error.REPORT_API_KEY_EXCEEDED)
}

// returns a response wrapped in a success code, if it was successful
function wrap(completeResponse) {
    if (completeResponse) {
        return {
            statusCode: 200,
            body: {
                ...completeResponse,
            },
        }
    }
    return completeResponse
}

// assumes the input is a question and returns a complete response to the question, with
// an object that contains all the possible responses, in order from best to worst (or
// an empty array of answers if there are no matches)
async function recallForQuestion(userId, deviceId, text) {
    let refinedText = wordModule.cutQuestionChatter(text)
    const recordedMemories = await dbModule.loadMemories(userId, deviceId)
    let bestMemories = selectBestMemoriesForQuestion(recordedMemories, refinedText)
    let response = {}
    response.answers = []
    if (bestMemories && bestMemories.length > 0) {
        for (let i = 0; i < bestMemories.length; i++) {
            const selectedMemory = bestMemories[i]
            response.answers[i] = {
                text: selectedMemory.Text,
                whenStored: selectedMemory.WhenStored,
                userId: selectedMemory.UserId,
                deviceId: selectedMemory.DeviceId,
                canTypeId: selectedMemory.CanTypeId || 'unknown',
                timezone: selectedMemory.Timezone || 'unknown',
                storeCountry: selectedMemory.StoreCountry || 'unknown',
                score: selectedMemory.Score,
                howLongAgo: timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored)), // TODO: use locale
            };
        }
        response.success = true
        response.speech = 'You told me ' + response.answers[0].howLongAgo + ': ' + response.answers[0].text + '.'
        response.serverVersion = SERVER_VERSION
    }
    else {
        response.success = false
        response.speech = 'I don\'t have a memory that makes sense as an answer for that.'
        response.serverVersion = SERVER_VERSION
    }
    return response
}

// select the memories that best match the question and returns an array of them,
// the best match is first in the returned array.
// returns null if there are no memories
function selectBestMemoriesForQuestion(memories, question) {
    if (memories && memories.length > 0) {
        // search for the right memory using words from the question
        let results = searchModule.searchThruDataForString(memories, question)

        if (results && results.length > 0) {
            return results
        }
        else {
            return null
        }
    }
    else {
        return null
    }
}

// returns a response object that contains everything about a statement, after storing information
async function memorizeStatement(userId, deviceId, canTypeId, timezone, storeCountry, text) {
    let refinedText = wordModule.cutStatementChatter(text)
    let response = {}
    if (refinedText) {
        const item = await dbModule.storeMemory(userId, deviceId, canTypeId, timezone, storeCountry, refinedText)
        if (item) {
            response.success = true
            response.text = item.Text
            response.whenStored = item.WhenStored
            response.userId = item.UserId
            response.deviceId = item.DeviceId
            response.howLongAgo = timeModule.getHowLongAgoText(Number(item.WhenStored)) // TODO: use locale
            response.speech = 'I will remember that you said: ' + refinedText + '.'
            response.serverVersion = SERVER_VERSION
        }
        else {
            response.success = false
            response.speech = 'I am sorry, I had a connection problem and could not store what you said.'
            response.serverVersion = SERVER_VERSION
        }
        return response
    }
    else {
        response.success = false
        response.speech = 'Hmmm, I heard you say, ' + text + ', but that didn\'t sound like a memory I could store.'
        response.serverVersion = SERVER_VERSION
        return response
    }
}

async function getList(userId, deviceId) {
    const recordedMemories = await dbModule.loadMemories(userId, deviceId)
    let response = {}
    response.answers = []
    if (recordedMemories && recordedMemories.length > 0) {
        for (let i = recordedMemories.length - 1; i >= 0; i--) {
            const selectedMemory = recordedMemories[i]
            response.answers.push({
                text: selectedMemory.Text,
                whenStored: selectedMemory.WhenStored,
                userId: selectedMemory.UserId,
                deviceId: selectedMemory.DeviceId,
                canTypeId: selectedMemory.CanTypeId || 'unknown',
                timezone: selectedMemory.Timezone || 'unknown',
                storeCountry: selectedMemory.StoreCountry || 'unknown',
                score: selectedMemory.Score,
                howLongAgo: timeModule.getHowLongAgoText(Number(selectedMemory.WhenStored)), // TODO: use locale
            })
        }
        response.success = true
        response.speech = 'You have ' + response.answers.length + (response.answers.length > 1 ? ' memories.' : ' memory')
        response.serverVersion = SERVER_VERSION
    }
    else {
        response.success = true
        response.speech = 'There are no memories.'
        response.serverVersion = SERVER_VERSION
    }
    return response
}

async function deleteOne(userId, deviceId, whenStored) {
    const item = {
        UserId: userId,
        WhenStored: whenStored,
    }
    const success = await dbModule.eraseOneMemory(item)
    let response = {
        userId: userId,
        deviceId: deviceId,
        whenStored: whenStored,
    }
    if (success) {
        response.success = true
        response.speech = 'I deleted that memory.'
    } else {
        response.success = false
        response.speech = 'There was a problem and I could not delete that memory.'
    }
    response.serverVersion = SERVER_VERSION
    return response
}

async function deleteAll(userId, deviceId) {
    const success = await dbModule.eraseAllMemories(userId, deviceId)
    let response = {
        userId: userId,
        deviceId: deviceId,
    }
    if (success) {
        response.success = true
        response.speech = 'I deleted all memories.'
    } else {
        response.success = false
        response.speech = 'There was a problem and I could not delete all memories.'
    }
    response.serverVersion = SERVER_VERSION
    return response
}

async function getReport(userId, deviceId) {
    let response
    const report = await reportModule.compileReport(userId, deviceId)
    if (report) {
        const storedReport = await dbModule.storeReport(userId, deviceId, SERVER_VERSION, report)
        const speech = storedReport
            ? 'Here is the report you requested.'
            : 'Here is the report, but I could not store a copy.'
        response = {
            success: true,
            speech: speech,
            serverVersion: SERVER_VERSION,
            report: report,
        }
    } else {
        response = {
            success: false,
            speech: 'Could not get the report.',
            serverVersion: SERVER_VERSION,
        }
    }
    return response;
}

function getHelp(canTypeId) {
    return {
        success: true,
        speech: helpModule.getHelpText(canTypeId),
        serverVersion: SERVER_VERSION,
    }
}
