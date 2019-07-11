#!/bin/bash

githubToken=$1
githubSigningSecret=$2


encrypt() {
    toEncrypt=$1
    echo $(aws kms encrypt --key-id alias/PIPELINE_KEY --plaintext $toEncrypt --query CiphertextBlob --output text);
}


# encrypt the parameters + setup parameter files
mkdir -p deploy/webhook

encryptedGithubToken=$(encrypt "$githubToken" "$account");
encryptedGithubSigningSecret=$(encrypt "$githubSigningSecret" "$account")

params=$(echo '{}' | jq ".GithubToken=\"$encryptedGithubToken\"");
params=$(echo "$params" | jq ".GithubSigningSecret=\"$encryptedGithubSigningSecret\"");
echo "$params" > deploy/webhook/params.json
