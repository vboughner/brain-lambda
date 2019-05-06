'use strict';

// makes sure that test don't run against live database (remove these lines and it will)
const mock = require('mock-require');
mock('../db.js', '../mock-db.js');

// bring in the whole application (mocks defined above will override some modules)
const app = require('../index.js');


// useful test utility, pass in a sequence of inputs and expected responses to be given
// to the getResponse method in the app, and each input will be given in turn,
// and the expected responses will be sought in the output strings, the done method will
// be called if provided, once the testing is completed
//
// sequence should be an array of objects that look like this:
//   {
//     input: 'some text to give as input',
//     response: 'some text expected in the response'
//     reprompt: 'some optional reprompt text'
//     hasReprompt: true/false  (forces a check on whether there is a reprompt)
//   }
//
// the 'done' and 'attributes' arguments are optional
//
function expectSequenceToWork(userId, deviceId, sequence, done, attributes) {
    if (sequence) {
        app.getResponse(userId, deviceId, sequence[0].input, attributes, (response, reprompt, updatedAttributes) => {
            if (sequence[0].response) {
                if (response) {
                    expect(response).toContain(sequence[0].response);
                }
                else {
                    expect('(no response)').toContain(sequence[0].reprompt);
                }
            }
            if (sequence[0].reprompt) {
                if (reprompt) {
                    expect(reprompt).toContain(sequence[0].reprompt);
                }
                else {
                    expect('(no reprompt)').toContain(sequence[0].reprompt);
                }
            }

            if (sequence[0].hasOwnProperty('hasReprompt')) {
                if (sequence[0].hasReprompt) {
                    expect(reprompt).toBeTruthy();
                }
                else {
                    expect(reprompt).toBeFalsy();
                }
            }

            if (sequence.length > 1) {
                expectSequenceToWork(userId, deviceId, sequence.slice(1), done, updatedAttributes);
            }
            else {
                if (done) {
                    done();
                }
            }
        });
    }
}


describe('test my brain', function () {
    let userId = 'testuser';
    let deviceId = 'testdevice';

    it('can forget everything', function (done) {
        let text = 'forget everything';
        app.getResponse(userId, deviceId, text, {},
            function (response, reprompt, attributes) {
                if (reprompt) {
                    expect(response).toContain('are you sure you want to erase');
                    app.getResponse(userId, deviceId, 'yes', attributes,
                        function (response) {
                            expect(response).toContain('all memories have been erased');
                            done();
                        }
                    );
                }
                else {
                    expect(response).toContain('there are no memories');
                    done();
                }
            }
        );
    });

    it('says there is no memory about brains', function (done) {
        let text = 'what about brains';
        app.getResponse(userId, deviceId, text, {},
            function (response) {
                expect(response).toContain('you asked me ' + text);
                expect(response).toContain('don\'t have a memory that makes sense');
                done();
            }
        );
    });

    it('can add a memory about brains', function (done) {
        let text = 'brains are tasty things';
        app.getResponse(userId, deviceId, text, {},
            function (response) {
                expect(response).toContain('will remember');
                expect(response).toContain(text);
                done();
            }
        );
    });

    it('says there is now a memory about brains', function (done) {
        let text = 'what about brains';
        app.getResponse(userId, deviceId, text, {},
            function (response) {
                expect(response).toContain('you asked me ' + text);
                expect(response).toContain('you told me');
                expect(response).toContain('brains are tasty things');
                done();
            }
        );
    });

    it('fixed bug: delete command is remembered in followups', function (done) {
        // steps to reproduce the bug:
        //   1. launch app so that it is in follow up mode
        //   2. give a new memory to remember
        //   3. say 'delete last thing'
        //   4. confirm with a 'yes'
        //   5. give another memory
        //   expected: will remember the memory
        //   actual: asks for confirmation to delete last thing again (that's the bug)
        // once this bug is fixed, this test should pass
        let seq = [
            {
                input: 'make launch request',
                response: 'something'
            },
            {
                input: 'here is a new thing',
                response: 'will remember'
            },
            {
                input: 'delete last thing',
                response: 'asked me to forget'
            },
            {
                input: 'yes',
                response: 'has been erased'
            },
            {
                input: 'here is another thing',
                response: 'will remember'
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('forgets one memory properly', function (done) {
        let seq = [
            {
                input: 'make launch request',
                response: 'something'
            },
            {
                input: 'forget everything',
                response: 'are you sure'
            },
            {
                input: 'yes',
                response: 'all memories have been erased'
            },
            {
                input: 'how many memories',
                response: 'not any memories'
            },
            {
                input: 'here is a new thing',
                response: 'will remember'
            },
            {
                input: 'how many memories',
                response: 'one memory'
            },
            {
                input: 'delete last thing',
                response: 'asked me to forget'
            },
            {
                input: 'yes',
                response: 'has been erased'
            },
            {
                input: 'how many memories',
                response: 'not any memories'
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('makes launch request and expects an answer', function (done) {
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('asks for help after launch', function (done) {
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'help',
                response: 'can help you remember',
                reprompt: 'or say done'
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('asks for help without launch', function (done) {
        let seq = [
            {
                input: 'help',
                response: 'can help you remember',
                reprompt: 'or say done'
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('asks for more help with launch', function (done) {
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'more help',
                response: 'more information about how I work',
                hasReprompt: true
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('asks for more help without launch', function (done) {
        let seq = [
            {
                input: 'more help',
                response: 'more information about how I work',
                hasReprompt: false
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('sees all the right question words as questions', function (done) {
        // insures there at least one memory, then erases all memories, to insure the
        // answer to all questions is that there is no memory to answer that question
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'store something memorable',
                response: 'will remember'
            },
            {
                input: 'forget everything',
                response: 'are you sure'
            },
            {
                input: 'yes',
                response: 'all memories have been erased'
            },
            {
                input: 'who was that man',
                response: 'answer to that question',
            },
            {
                input: 'what was that thing',
                response: 'answer to that question',
            },
            {
                input: 'where is the fly house',
                response: 'answer to that question',
            },
            {
                input: 'when did i ask a question last',
                response: 'answer to that question',
            },
            {
                input: 'how are you feeling today',
                response: 'answer to that question',
            },
            {
                input: 'how many times do I need to ask',
                response: 'answer to that question',
            },
            {
                input: 'about the time with oranges',
                response: 'answer to that question',
            },
            {
                input: 'does the phone number ring a bell',
                response: 'answer to that question',
            },
            {
                input: 'am i okay to take my medication now',
                response: 'answer to that question',
            },
            {
                input: 'are you telling me that i can do that',
                response: 'answer to that question',
            },
            {
                input: 'is the dinner ready now',
                response: 'answer to that question',
            },
            {
                input: 'has the watermelon been brought hom',
                response: 'answer to that question',
            },
            {
                input: 'have i taken my vitamins today',
                response: 'answer to that question',
            },
            {
                input: 'did i take my cough supressant',
                response: 'answer to that question',
            },
            {
                input: 'two words',
                response: 'answer to that question',
            },
            {
                input: 'word',
                response: 'answer to that question',
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('stores 6 memories then recalls them all in two groups', function (done) {
        // insures there at least one memory, then erases all memories, to insure
        // we can know exactly how many memories there are
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'store something memorable',
                response: 'will remember'
            },
            {
                input: 'forget everything',
                response: 'are you sure'
            },
            {
                input: 'yes',
                response: 'all memories have been erased'
            },
            {
                input: 'this is memory 1',
                response: 'will remember',
            },
            {
                input: 'this is memory 2',
                response: 'will remember',
            },
            {
                input: 'this is memory 3',
                response: 'will remember',
            },
            {
                input: 'this is memory 4',
                response: 'will remember',
            },
            {
                input: 'this is memory 5',
                response: 'will remember',
            },
            {
                input: 'this is memory 6',
                response: 'will remember',
            },
            {
                input: 'how many memories',
                response: 'are 6 memories',
            },
            {
                input: 'recall all memories',
                response: 'this is memory 2. would you like to hear more',
            },
            {
                input: 'yes',
                response: 'this is memory 1. that is all',
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    it('stores 1 memory then recalls all and expects just the one', function (done) {
        // insures there at least one memory, then erases all memories, to insure
        // we can know exactly how many memories there are
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'store something memorable',
                response: 'will remember'
            },
            {
                input: 'forget everything',
                response: 'are you sure'
            },
            {
                input: 'yes',
                response: 'all memories have been erased'
            },
            {
                input: 'this is memory 1',
                response: 'will remember',
            },
            {
                input: 'how many memories',
                response: 'is one memory',
            },
            {
                input: 'recall all memories',
                response: 'this is memory 1. that is all. Say something',
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });

    // TODO: figure out why this test does not pass (I think it's has to do with storage dates)
    xit('stores 6 memories then recalls them using a question in two groups', function (done) {
        // insures there at least one memory, then erases all memories, to insure
        // we can know exactly how many memories there are
        let seq = [
            {
                input: 'make launch request',
                response: 'something',
                reprompt: 'or say help'
            },
            {
                input: 'store something memorable',
                response: 'will remember'
            },
            {
                input: 'forget everything',
                response: 'are you sure'
            },
            {
                input: 'yes',
                response: 'all memories have been erased'
            },
            {
                input: 'this is memory 1',
                response: 'will remember',
            },
            {
                input: 'this is memory 2',
                response: 'will remember',
            },
            {
                input: 'this is memory 3',
                response: 'will remember',
            },
            {
                input: 'this is memory 4',
                response: 'will remember',
            },
            {
                input: 'this is memory 5',
                response: 'will remember',
            },
            {
                input: 'this is memory 6',
                response: 'will remember',
            },
            {
                input: 'what about memory',
                response: 'this is memory 6',
            },
            {
                input: 'yes',
                response: 'this is memory 1',
            },
        ];
        expectSequenceToWork(userId, deviceId, seq, done);
    });
});
