const { STS, IAM, CloudFormation } = require("aws-sdk");

const SECURITY_STACK_NAME = "pipelines-security";

async function getCurrentAccountId() {
    try {
        const sts = new STS();
        const response = await sts.getCallerIdentity().promise();

        return response.Account;
    } catch(error) {
        return undefined;
    }
}

async function getAccountClients(roleArn) {
    try {
        const sts = new STS();
        const response = await sts.assumeRole({
            RoleArn: roleArn,
            RoleSessionName: "BootstrapPipelineSecurity"
        }).promise();
        
        const { AccessKeyId, SecretAccessKey, SessionToken } = response.Credentials;

        return {
            cloudformation: new CloudFormation({
                accessKeyId: AccessKeyId,
                secretAccessKey: SecretAccessKey,
                sessionToken: SessionToken,
            }),

            iam: new IAM({
                accessKeyId: AccessKeyId,
                secretAccessKey: SecretAccessKey,
                sessionToken: SessionToken,
            })
        }
    } catch(error) {
        console.log("could not assume temp admin role");
        return undefined;
    }
}

async function stackExists(StackName, cloudformation = new CloudFormation()) {
    try {
        await cloudformation.describeStack({ StackName }).promise();
        return true;
    } catch(error) {
        return false;
    }
}

async function getTemplate(StackName, cloudformation = new CloudFormation()) {
    try {
        let result = await cloudformation.getTemplate({ StackName }).promise();
        return result.TemplateBody;
    } catch(error) {
        console.log("could not fetch template");
        return undefined;
    }
}

async function deleteTempAdminRole(RoleName, iam = new IAM()) {
    let response = (await iam.listAttachedRolePolicies({ RoleName }).promise());
    let policies = response.AttachedPolicies;

    for(let { PolicyArn } of policies) {
        await iam.detachRolePolicy({
            RoleName,
            PolicyArn
        }).promise();
    }

    await iam.deleteRole({ RoleName }).promise();
}

exports.handler = async function(event, context) {
    if(!event || !event.role) {
        console.log("received invalid parameters.");
        return;
    }

    let roleName = event.role.split("/")[1];
    let accountId = await getCurrentAccountId();
    let { cloudformation, iam } = await getAccountClients(event.role);

    if(await stackExists(SECURITY_STACK_NAME, cloudformation)) {
        console.log("security stack already exists.");
        return;
    }

    try {
        let template = await getTemplate(SECURITY_STACK_NAME);
        let response = await cloudformation.createStack({
            StackName: SECURITY_STACK_NAME,
            TemplateBody: template,
            Parameters: [
                {
                    ParameterKey: "ParentAccountId",
                    ParameterValue: accountId
                }
            ],
            Capabilities: [
                "CAPABILITY_NAMED_IAM"
            ]
        }).promise();

        console.log(response);

        await cloudformation.waitFor("stackCreateComplete", { StackName: SECURITY_STACK_NAME }).promise();
        await deleteTempAdminRole(roleName, iam);
    } catch(error) {
        console.log("unexpected error occurred: " + error);
    }
}