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
    let maxMemoriesOnOneUserId = ''
    let oldestMemoryTimestamp = currentTimestamp
    let newestMemoryTimestamp = 0

    everything.forEach((memory) => {
        const list = userToMemoryMap.get(memory.UserId)
        if (list) {
            list.push(memory)
            if (list.length > maxMemoriesOnOneUser) {
                maxMemoriesOnOneUser = list.length
                maxMemoriesOnOneUserId = memory.UserId
            }
        } else {
            userToMemoryMap.set(memory.UserId, [memory])
        }
        oldestMemoryTimestamp = Math.min(oldestMemoryTimestamp, memory.WhenStored)
        newestMemoryTimestamp = Math.max(newestMemoryTimestamp, memory.WhenStored)
    })

    const numUniqueUsers = userToMemoryMap.size
    const averageMemoriesPerUser = Math.round(numTotalMemories / numUniqueUsers * 100) / 100

    // uncomment momentarily to check for abuse from a user with too many memories
    // const maxMemoryUserList = userToMemoryMap.get(maxMemoriesOnOneUserId)
    // const maxMemoryUserMemories = []
    // maxMemoryUserList.forEach((memory) => maxMemoryUserMemories.push(memory.Text))
    // console.log('max user list of memories', JSON.stringify(maxMemoryUserMemories, null, 2))

    return {
        currentTimestamp,
        numTotalMemories,
        numUniqueUsers,
        averageMemoriesPerUser,
        maxMemoriesOnOneUser,
        maxMemoriesOnOneUserId,
        oldestMemoryTimestamp,
        oldestMemoryTimeAgo: timeModule.getHowLongAgoText(Number(oldestMemoryTimestamp)),
        newestMemoryTimestamp,
        newestMemoryTimeAgo: timeModule.getHowLongAgoText(Number(newestMemoryTimestamp)),
        reportRequestedByUserId: userId,
        reportRequestedByDeviceId: deviceId,
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
