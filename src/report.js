'use strict'

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
    let numNewMemoriesInDay = 0
    let numNewMemoriesInWeek = 0
    let numNewMemoriesInMonth = 0
    let numUsersActiveInDay = 0
    let numUsersActiveInWeek = 0
    let numUsersActiveInMonth = 0
    let numCharactersStored = 0
    let minCharactersStored = 99999
    let maxCharactersStored = 0

    const msInDay = 1000 * 60 * 60 * 24
    const msInWeek = msInDay * 7
    const msInMonth = msInDay * 30

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
        const msSinceMemoryMade = currentTimestamp - memory.WhenStored
        if (msSinceMemoryMade <= msInDay) {
            numNewMemoriesInDay++
        }
        if (msSinceMemoryMade <= msInWeek) {
            numNewMemoriesInWeek++
        }
        if (msSinceMemoryMade <= msInMonth) {
            numNewMemoriesInMonth++
        }
        const numCharacters = memory.Text.length
        minCharactersStored = Math.min(minCharactersStored, numCharacters)
        maxCharactersStored = Math.max(maxCharactersStored, numCharacters)
        numCharactersStored += numCharacters
    })

    const numUniqueUsers = userToMemoryMap.size
    const averageMemoriesPerUser = numUniqueUsers ? Math.round(numTotalMemories / numUniqueUsers * 100) / 100 : 0
    const averageCharactersPerMemory = numTotalMemories ? Math.round(numCharactersStored / numTotalMemories * 100) / 100 : 0
    const averageCharactersPerUser = numUniqueUsers ? Math.round(numCharactersStored / numUniqueUsers * 100) / 100 : 0

    userToMemoryMap.forEach((memories, userId, map) => {
        let mostRecentlyAddedTimestamp = 0
        memories.forEach((memory) => {
            if (memory.WhenStored > mostRecentlyAddedTimestamp) {
                mostRecentlyAddedTimestamp = memory.WhenStored
            }

        })
        const msSinceMemoryMade = currentTimestamp - mostRecentlyAddedTimestamp
        if (msSinceMemoryMade <= msInDay) {
            numUsersActiveInDay++
        }
        if (msSinceMemoryMade <= msInWeek) {
            numUsersActiveInWeek++
        }
        if (msSinceMemoryMade <= msInMonth) {
            numUsersActiveInMonth++
        }
    })

    const numUsersInactiveForMoreThanMonth = numUniqueUsers - numUsersActiveInMonth

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
        numNewMemoriesInDay,
        numNewMemoriesInWeek,
        numNewMemoriesInMonth,
        numUsersActiveInDay,
        numUsersActiveInWeek,
        numUsersActiveInMonth,
        numUsersInactiveForMoreThanMonth,
        numCharactersStored,
        minCharactersStored,
        maxCharactersStored,
        averageCharactersPerMemory,
        averageCharactersPerUser,
        reportRequestedByUserId: userId,
        reportRequestedByDeviceId: deviceId,
    }
}

// noinspection JSUnresolvedVariable
module.exports = {
    compileReport: compileReport,
}
