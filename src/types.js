'use strict'

// action types for REST api operations, these should be the same as those in the capsule types.js file
const ACTION_TYPE_MEMORIZE = 'memorize'
const ACTION_TYPE_RECALL = 'recall'
const ACTION_TYPE_LIST = 'list'
const ACTION_TYPE_DELETE_ALL = 'delete-all'
const ACTION_TYPE_DELETE_ONE = 'delete-one'
const ACTION_TYPE_GET_REPORT = 'get-report'

const VALID_TYPES = [
    ACTION_TYPE_MEMORIZE,
    ACTION_TYPE_RECALL,
    ACTION_TYPE_LIST,
    ACTION_TYPE_DELETE_ALL,
    ACTION_TYPE_DELETE_ONE,
    ACTION_TYPE_GET_REPORT,
]

// noinspection JSUnresolvedVariable
module.exports = {
    VALID_TYPES: VALID_TYPES,
    ACTION_TYPE_MEMORIZE: ACTION_TYPE_MEMORIZE,
    ACTION_TYPE_RECALL: ACTION_TYPE_RECALL,
    ACTION_TYPE_LIST: ACTION_TYPE_LIST,
    ACTION_TYPE_DELETE_ALL: ACTION_TYPE_DELETE_ALL,
    ACTION_TYPE_DELETE_ONE: ACTION_TYPE_DELETE_ONE,
    ACTION_TYPE_GET_REPORT: ACTION_TYPE_GET_REPORT,
}
