'use strict';

const dbModule = require('./db')
const timeModule = require('./time')
const error = require('./error.js')

// scans everything in the database and returns a report
async function compileReport(userId, deviceId) {
    const everything = await dbModule.loadEverything()
    if (!everything) {
        return error.getResponse(error.REPORT_FAILED)
    }
    if (everything.length === 0) {
        return error.getResponse(error.UNSPECIFIED, 'no memories to report on')
    }

    const currentTimestamp = Date.now()
    const numTotalMemories = everything.length
    const userToMemoryMap = new Map()
    let maxMemoriesOnOneUser = 1
    let oldestMemoryTimestamp = currentTimestamp
    let newestMemoryTimestamp = 0

    everything.forEach((memory) => {
        const list = userToMemoryMap.get(memory.UserId)
        if (list) {
            list.push(memory)
            maxMemoriesOnOneUser = Math.max(maxMemoriesOnOneUser, list.length)
        } else {
            userToMemoryMap.set(memory.UserId, [memory])
        }
        oldestMemoryTimestamp = Math.min(oldestMemoryTimestamp, memory.WhenStored)
        newestMemoryTimestamp = Math.max(newestMemoryTimestamp, memory.WhenStored)
    })

    const numUniqueUsers = userToMemoryMap.size
    const averageMemoriesPerUser = Math.round(numTotalMemories / numUniqueUsers * 100) / 100

    return {
        userId,
        deviceId,
        currentTimestamp,
        numTotalMemories,
        numUniqueUsers,
        averageMemoriesPerUser,
        maxMemoriesOnOneUser,
        oldestMemoryTimestamp,
        oldestMemoryTimeAgo: timeModule.getHowLongAgoText(Number(oldestMemoryTimestamp)),
        newestMemoryTimestamp,
        newestMemoryTimeAgo: timeModule.getHowLongAgoText(Number(newestMemoryTimestamp)),
    }
}

// stores the report in the database for reports, keyed by currentTimestamp in the report
async function storeReport(userId, deviceId, report) {
    // TODO: store the report in a table meant for reports and keyed by timestamp
    // TODO: update the callers of getReport to also call storeReport
}

// noinspection JSUnresolvedVariable
module.exports = {
    compileReport: compileReport,
    storeReport: storeReport,
};
