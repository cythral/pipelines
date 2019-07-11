const { CloudFormation } = require("aws-sdk");
const cloudformation = new CloudFormation();

async function deploy(options) {
    if(!options.StackName) {
        return;
    } else if(!await stackExists(options.StackName)) {
        options.OnFailure = "DELETE";
        cloudformation.createStack(options);
    } else {
        cloudformation.updateStack(options);
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