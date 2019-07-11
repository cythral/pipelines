/**
 * This file is separate from the pipelines deployer.  Instead
 * it is used by a lambda to create an organization account.  It
 * is included in this folder to make testing easier
 */
const { Organizations, Lambda } = require("aws-sdk");
const { promisify } = require("util");
const { parse } = require("url");
const https = require("https");
const organizations = new Organizations();
const lambda = new Lambda();
const sleep = promisify(setTimeout);

/**
 * Send a response to cloudformation
 */
const response = {
    send(event, context, status, data) {
        return new Promise((resolve, reject) => {
            var responseBody = JSON.stringify({
                Status: status,
                Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
                PhysicalResourceId: context.logStreamName,
                StackId: event.StackId,
                RequestId: event.RequestId,
                LogicalResourceId: event.LogicalResourceId,
                Data: data
            });

            let url = parse(event.ResponseURL);
            let request = https.request({
                hostname: url.hostname,
                port: 443,
                path: url.path,
                method: "PUT",
                headers: {
                    "content-type": "",
                    "content-length": responseBody.length
                }
            }, response => resolve(response.statusMessage));

            request.write(responseBody);
            request.end();
        });
    }
};

/**
 * Gets the account and organization ids that are tied to an email
 * 
 * @param email the email address tied to the account 
 */
async function getAccountIds(email) {
    let results = (await organizations.listAccounts({}).promise()).Accounts;
    email = email.trim().toLowerCase();

    for(let result of results) {
        if(result.Email.trim().toLowerCase() === email) {
            return {
                AccountId: result.Id,
                OrganizationId: result.Arn.split("/")[1]
            };
        }
    }

    return undefined;
}

/**
 * Handle an account creation request
 * 
 * @param event the payload sent by cloudformation
 * @param context the lambda context
 */
async function handleCreate(event, context) {
    const params = {
        AccountName: event.ResourceProperties.AccountName,
        Email: event.ResourceProperties.Email,
        RoleName: "TemporaryAdmin",
    };

    let { Id } = (await organizations.createAccount(params).promise()).CreateAccountStatus;
    let State = "IN_PROGRESS";

    while(State === "IN_PROGRESS") {
        await sleep(500); 
        // todo: test & debug this section more - the createAccount call succeeds but for some reason this part errors with "another request already in progress
        // temp workaround - delete the stack and bring it back up
        let response = await organizations.describeCreateAccountStatus({ CreateAccountRequestId: Id }).promise();
        let status = response.CreateAccountStatus;

        State = status.State;
    }
    
    let ids = await getAccountIds(event.ResourceProperties.Email);
    return ids;
}

/**
 * Handle account related custom resource events
 */
exports.handler = async function(event, context) {
    if(!event.ResourceProperties || 
        !event.ResourceProperties.AccountName ||
        !event.ResourceProperties.Email) {
        
        return await response.send(event, context, "FAILED");
    }

    let ids = await getAccountIds(event.ResourceProperties.Email);
    let type = event.RequestType.toLowerCase();

    try {
        if(type === "create" && typeof ids === "undefined") {
            ids = await handleCreate(event, context);
        }
        
        if(type !== "delete") {
            let role = `arn:aws:iam::${ids.AccountId}:role/TemporaryAdmin`;
            await lambda.invoke({
                FunctionName: "bootstrap-account-security",
                Payload: JSON.stringify({ role })
            }).promise();
        }

        await response.send(event, context, "SUCCESS", ids);
        
    } catch(error) {
        console.error(error);
        return await response.send(event, context, "FAILED", { error });
    }
}