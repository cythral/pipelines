let jestFetch = require("jest-fetch-mock");
jest.setMock("node-fetch", jestFetch);
jest.mock("node-fetch");

jest.mock("aws-sdk", () => {
    let CloudFormation = function() {};
    CloudFormation.prototype = {
        createStack: jest.fn(),
        updateStack: jest.fn(),
        describeStacks: jest.fn(),
    }
    return {
        CloudFormation
    }
});

const fetch = require("node-fetch");

const {
    handle,
    validateAndRetrieveVars, 
    VerificationError, 
    InvalidJsonError, 
    UnhandledEventError, 
    NoContentsUrlError, 
    InvalidContentsUrlError 
} = require("../src/webhook");

describe("validateAndRetrieveVars", () => {
    it("should throw a VerificationError if the body does not match the signature", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            '{"test":"value"}', 
            "sha1=fakeSignature",
            "secret key"
        );
        expect(handler).toThrow(VerificationError);
    });

    it("should not throw a VerificationError if the body matches the signature", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            '{"test":"value"}',
            "sha1=693c61dd89aca38208d167ef709c4b2f7a28129f",
            "secret key"
        );
        expect(handler).not.toThrow(VerificationError);
    });

    it("should throw an InvalidJsonError if the body is not valid json", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            '{"test":"value"',
            "sha1=0b79b9ba961f5e639b904f39c14c217f3535d0a7",
            "secret key"
        );
        expect(handler).toThrow(InvalidJsonError);
    });

    it("should throw an InvalidEventError if the event is not push", () => {
        const handler = () => validateAndRetrieveVars(
            "pull_request_opened",
            '{"test":"value"}',
            "sha1=693c61dd89aca38208d167ef709c4b2f7a28129f",
            "secret key"
        );
        expect(handler).toThrow(UnhandledEventError);
    });

    it("should throw a NoContentsUrlError if the event does not have a contents url", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            '{"test":"value"}',
            "sha1=693c61dd89aca38208d167ef709c4b2f7a28129f",
            "secret key"
        );
        expect(handler).toThrow(NoContentsUrlError);
    });

    it("should throw an InvalidContentsUrlError if the contents_url is not for a cythral repository", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            JSON.stringify({
                repository: {
                    contents_url: "https://api.github.com/repos/Codertocat/Hello-World/contents/{+path}"
                }
            }),
            "sha1=0c87e6be9ced7a164c532f5f03c394b383dc9d2b",
            "secret key"
        );
        expect(handler).toThrow(InvalidContentsUrlError);
    });

    it("should not throw an InvalidContentsUrlError if the contents_url is for a cythral repository", () => {
        const handler = () => validateAndRetrieveVars(
            "push",
            JSON.stringify({
                repository: {
                    contents_url: "https://api.github.com/repos/Cythral/Hello-World/contents/{+path}"
                }
            }),
            "sha1=d3290608948773da0954e1d67b2f20b0f0fa51e2",
            "secret key"
        );
        expect(handler).not.toThrow(InvalidContentsUrlError);
    });
});

describe("handle", () => {
    it("should retrieve the cicd.template.yml using the contents url in the payload via fetch", async () => {
        await handle(
            "push",
            JSON.stringify({
                repository: {
                    contents_url: "https://api.github.com/repos/Cythral/Hello-World/contents/{+path}"
                }
            }),
            "sha1=d3290608948773da0954e1d67b2f20b0f0fa51e2",
            "secret key"
        );

        expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/Cythral/Hello-World/contents/cicd.template.yml", {
            headers: {
                Authorization: "token undefined"
            }
        });
    });

    it("should retrieve the cicd.config.json file using the contents url in the payload via fetch", async () => {
        await handle(
            "push",
            JSON.stringify({
                repository: {
                    contents_url: "https://api.github.com/repos/Cythral/Hello-World/contents/{+path}"
                }
            }),
            "sha1=d3290608948773da0954e1d67b2f20b0f0fa51e2",
            "secret key"
        );

        expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/Cythral/Hello-World/contents/cicd.config.json", {
            headers: {
                Authorization: "token undefined"
            }
        });
    });
});