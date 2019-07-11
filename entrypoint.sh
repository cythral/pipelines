#!/bin/sh

decrypt() {
    ENCRYPTED_VAR=$1

    if [ "$ENCRYPTED_VAR" = "" ]; then
        echo "";
        return 0;
    fi

    TMP_FILE=$(mktemp);
    echo "$ENCRYPTED_VAR" | base64 -d > $TMP_FILE
    echo $(aws kms decrypt --ciphertext-blob fileb://$TMP_FILE --query Plaintext --output text);
    rm $TMP_FILE;
}

export GITHUB_TOKEN=$(decrypt "$ENCRYPTED_GITHUB_TOKEN");
export GITHUB_SIGNING_SECRET=$(decrypt "$ENCRYPTED_GITHUB_SIGNING_SECRET");

node src/server.js