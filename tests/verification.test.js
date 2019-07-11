const { hash, verify } = require("../src/verification");

describe("hash", () => {
    it("Should return a hash of the payload parameter that starts with sha1=", () => {
        let result = hash("payload", "secret key");
        expect(result).toBe("sha1=9af5894caf5d500fa6b1d35ed6ddde662a7f35d3");
    });
});

describe("verify", () => {
    it("Should return true if the signature matches the SHA1 digest of the payload", () => {
        let result = verify("payload", "sha1=9af5894caf5d500fa6b1d35ed6ddde662a7f35d3", "secret key");
        expect(result).toBe(true);
    });

    it("Should return false if the signature does not match the SHA1 digest of the payload", () => {
        let result = verify("payload", "sha1=fakeSignature", "secret key");
        expect(result).toBe(false);
    });
});