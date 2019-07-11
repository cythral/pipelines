#!/bin/bash

set -e

securityStackName=pipelines-security
securityStackTemplate=deploy/security.template.yml
githubToken=
githubSigningSecret=

error() {
    echo $1
    exit 1
}


while :; do
    case $1 in
        --githubToken)
            if [ "$2" ]; then
                githubToken=$2
                shift
            else
                error "--githubToken requires a token to be specified"
            fi
            ;;

        --githubSigningSecret)
            if [ "$2" ]; then
                githubSigningSecret=$2
                shift
            else
                error "--githubSigningSecret requires a token to be specified"
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
    error "Github Token must be specified"
fi

if [ "$githubSigningSecret" = "" ]; then
    error "Github Signing Secret must be specified"
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

# Encrypt params
echo "setting up parameters...";
scripts/encryptParams.sh $githubToken $githubSigningSecret

git add deploy/
git commit -m "add parameters"
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
