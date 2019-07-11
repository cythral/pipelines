const { HmacSHA1 } = require("crypto-js");

function hash(payload, secretKey) {
    return `sha1=${HmacSHA1(payload, secretKey)}`;
}

function verify(payload, signature, secretKey) {
    let actual = hash(payload, secretKey);
    
    console.log(`verifying ${payload} against ${signature}`);
    return signature === actual;
}

exports.hash = hash;
exports.verify = verify;
exports.VerificationError = class extends Error {}