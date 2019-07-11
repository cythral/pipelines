#!/bin/bash

set -e

securityStackName=pipelines-security
securityStackTemplate=deploy/security.template.yml
githubToken=
githubSigningSecret=
domainName=

error() {
    echo $1
    exit 1
}

encrypt() {
    toEncrypt=$1
    echo $(aws kms encrypt --key-id alias/PIPELINE_KEY --plaintext $toEncrypt --query CiphertextBlob --output text);
}

while :; do
    case $1 in
        --githubToken)
            if [ "$2" ]; then
                githubToken=$2
                shift
            else
                error "--githubToken requires a value"
            fi
            ;;

        --githubSigningSecret)
            if [ "$2" ]; then
                githubSigningSecret=$2
                shift
            else
                error "--githubSigningSecret requires a value"
            fi
            ;;

        --domainName)
            if [ "$2" ]; then
                domainName=$2
                shift
            else
                error "--domainName requires a value"
            fi
            ;;

        --)
            shift
            break
            ;;

        *)
            break
            ;;
    esac
    shift
done


if [ "$githubToken" = "" ]; then
    error "--githubToken is required"
fi

if [ "$githubSigningSecret" = "" ]; then
    error "--githubSigningSecret is required"
fi

if [ "$domainName" = "" ]; then
    error "--domainName is required"
fi

# Deploy the storage stack
bucketName=pipelines-bootstrap-artifacts
aws s3 mb s3://$bucketName

packagedTemplateFile=$(mktemp);

# Deploy the pipelines-security stack
aws cloudformation validate-template \
    --template-body file://$securityStackTemplate

aws cloudformation deploy \
    --stack-name $securityStackName \
    --template-file $securityStackTemplate \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

# Deploy the pipelines-accounts stack
# Note: if this times out or fails the first time, deleting the stack and re-deploying should work
# There is an issue with creating organization accounts that sometimes either takes too long or an error occurs (but the account gets created anyways)
zip -jr deploy/accounts.zip src/accounts/*

aws cloudformation validate-template \
    --template-body file://deploy/accounts.template.yml

aws cloudformation package \
    --template-file deploy/accounts.template.yml \
    --s3-bucket $bucketName \
    --s3-prefix packageArtifacts \
    --output-template-file $packagedTemplateFile 

aws cloudformation deploy \
    --template-file $packagedTemplateFile \
    --stack-name pipelines-accounts \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

rm -f deploy/accounts.zip

# Setup Params
encryptedGithubToken=$(encrypt "$githubToken");
encryptedGithubSigningSecret=$(encrypt "$githubSigningSecret")

params=$(echo '{"Webhook":{},"Dns":{}}' | jq ".Webhook.GithubToken=\"$encryptedGithubToken\"");
params=$(echo "$params" | jq ".Webhook.GithubSigningSecret=\"$encryptedGithubSigningSecret\"");
params=$(echo "$params" | jq ".Dns.DomainName=\"$domainName\"");
echo "$params" > deploy/params.json

git add deploy/params.json
git commit -m "setup parameters"
git push origin master

# Deploy the pipelines-cicd stack
aws cloudformation validate-template \
    --template-body file://cicd.template.yml

aws cloudformation deploy \
    --stack-name pipelines-cicd \
    --template-file cicd.template.yml \
    --parameter-overrides "GithubToken=$githubToken" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset
