const { CloudFormation, STS, EC2, CodePipeline, Route53 } = require("aws-sdk");
const sts = new STS();
const ec2 = new EC2();
const codepipeline = new CodePipeline();

async function getDefaultVpcId() {
    let response = await ec2.describeVpcs({
        Filters: [
            {
                Name: "isDefault",
                Values: [
                    'true'
                ]
            }
        ]
    }).promise();

    return response.Vpcs[0].VpcId;
}

async function getDeployerInstances(accountId) {
    let response = await sts.assumeRole({
        RoleArn: `arn:aws:iam::${accountId}:role/Deployer`, 
        RoleSessionName: `CreateHostedZoneAssociationRequest`
    }).promise();
    
    let { AccessKeyId, SecretAccessKey, SessionToken } = response.Credentials;
    let options = {
        accessKeyId: AccessKeyId,
        secretAccessKey: SecretAccessKey,
        sessionToken: SessionToken
    };

    let cloudformation = new CloudFormation(options);
    let route53 = new Route53(options);

    return {
        cloudformation,
        route53
    };
}

async function getHostedZoneIdFromNetworkingStack(cloudformation) {
    let response = await cloudformation.describeStacks({ StackName: "pipelines-networking" }).promise();
    let stack = response.Stacks[0];
    console.log(stack.Outputs);
    
    for(let output of stack.Outputs) {
        if(output.ExportName === "pipelines-networking:BaseHostedZoneId") {
            return output.OutputValue;
        }
    }

    return null;
}

/**
 * This Lambda function is to be run by CodePipeline after the pipelines-networking stack is deployed to each account
 */
exports.handler = async function(event) {
    let jobId = event["CodePipeline.job"].id;
    let { AccountId } = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters);
    let VPCId = await getDefaultVpcId();
    let VPCRegion = process.env.AWS_REGION;
    let { cloudformation, route53 } = await getDeployerInstances(AccountId);
    let HostedZoneId = await getHostedZoneIdFromNetworkingStack(cloudformation);
    
    try {
        // create authorization request
        await route53.createVPCAssociationAuthorization({
            HostedZoneId,
            VPC: {
                VPCId,
                VPCRegion
            }
        }).promise();

        // approve authorization request
        route53 = new Route53();
        await route53.associateVPCWithHostedZone({
            HostedZoneId,
            VPC: {
                VPCId,
                VPCRegion
            }
        }).promise();
        
        await codepipeline.putJobSuccessResult({ jobId }).promise();
    } catch(error) {
        if(error.toString().substring(0, 24) === "ConflictingDomainExists:") {
            await codepipeline.putJobSuccessResult({ jobId }).promise();
        } else {
            await codepipeline.putJobFailureResult({ 
                jobId, 
                failureDetails: {
                    message: error.toString(),
                    type: "JobFailed",
                }        
            }).promise();
        }
    }
};
