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
    const memoryCanTypeIdCountMap = {}

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
        if (memory.CanTypeId) {
            const currentValue = memoryCanTypeIdCountMap[memory.CanTypeId] || 0
            memoryCanTypeIdCountMap[memory.CanTypeId] = currentValue + 1
        } else {
            const currentValue = memoryCanTypeIdCountMap['unknown'] || 0
            memoryCanTypeIdCountMap['unknown'] = currentValue + 1
        }
    })

    const numUniqueUsers = userToMemoryMap.size
    const averageMemoriesPerUser = numUniqueUsers ? Math.round(numTotalMemories / numUniqueUsers * 100) / 100 : 0
    const averageCharactersPerMemory = numTotalMemories ? Math.round(numCharactersStored / numTotalMemories * 100) / 100 : 0
    const averageCharactersPerUser = numUniqueUsers ? Math.round(numCharactersStored / numUniqueUsers * 100) / 100 : 0

    const userStoreCountryCountMap = {}
    const userTimezoneCountMap = {}
    userToMemoryMap.forEach((memories, userId, map) => {
        let storeCountry = 'unknown'
        let timezone = 'unknown'
        let mostRecentlyAddedTimestamp = 0
        memories.forEach((memory) => {
            if (memory.WhenStored > mostRecentlyAddedTimestamp) {
                mostRecentlyAddedTimestamp = memory.WhenStored
            }
            if (memory.StoreCountry) {
                storeCountry = memory.StoreCountry
            }
            if (memory.Timezone) {
                timezone = memory.Timezone
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
        const currentStoreCountryCount = userStoreCountryCountMap[storeCountry] || 0
        userStoreCountryCountMap[storeCountry] = currentStoreCountryCount + 1
        const currentTimezoneCount = userTimezoneCountMap[timezone] || 0
        userTimezoneCountMap[timezone] = currentTimezoneCount + 1
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
        memoryCanTypeIdCountMap,
        userStoreCountryCountMap,
        userTimezoneCountMap,
        reportRequestedByUserId: userId,
        reportRequestedByDeviceId: deviceId,
    }
}

// noinspection JSUnresolvedVariable
module.exports = {
    compileReport: compileReport,
}
