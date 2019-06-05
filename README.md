# brain-lambda

## Storage Architecture

This repo contains the code that runs in the AWS lambda and access the DynamoDB for storing and retrieving memories. In the diagram below, the code here is everything inside the Lambda diamond.

The Dev Center, API Gateway, and Dynamo DB don't have any code of their own, but they need configuration (TODO: add details about how to configure these).

The Bixby Capsule code is stored in the [van.memory](https://github.com/vboughner/van.memory) repo.

![Storage Architecture](storage-architecture.png)

## Instructions

Run `yarn install` to make sure all the npm modules are loaded, including in the `src` folder.

To deploy new code to the AWS lambda, you need the AWS configuration (permissions), and run `yarn deploy`

To store a memory from the command line use `yarn run statement 'place statement text here'`

To try a question from the command line use `yarn run question 'place question text here'`

To list all memories from the command line use `yarn run list`
