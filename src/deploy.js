const { CloudFormation } = require("aws-sdk");
const cloudformation = new CloudFormation();

async function deploy(options) {
    if(!options.StackName) {
        return;
    } else if(!await stackExists(options.StackName)) {
        options.OnFailure = "DELETE";
        await cloudformation.createStack(options).promise();
    } else {
        await cloudformation.updateStack(options).promise();
    }
}

async function stackExists(name) {
    try {
        let result = await cloudformation.describeStacks({
            StackName: name
        }).promise();
        return result.Stacks.length > 0;
    } catch(error) {
        return false;
    }
}

exports.deploy = deploy;
exports.stackExists = stackExists;