let jestFetch = require("jest-fetch-mock");
jest.setMock("node-fetch", jestFetch);
jest.mock("node-fetch");

const {
    fetchFileFromContentsUrl,
    fetchTemplate,
    fetchConfig
} = require("../src/fetch");

const fetch = require("node-fetch");

function mockContentsPayload(fileContents) {
    return JSON.stringify({
        content: Buffer.from(fileContents).toString("base64"),
        encoding: "base64"
    });
}

describe("fetchFileFromContentsUrl", () => {
    it("should return the utf8 contents from a contents url", async () => {
        let expected = "test file contents";
        fetch.mockResponse(mockContentsPayload(expected));

        let result = await fetchFileFromContentsUrl("cicd.template.yml", "https://api.github.com/repos/Cythral/pipelines/contents");
        expect(result).toBe(expected);
    });

    it("should return null if the contents url does not return json", async () => {
        fetch.mockResponse('surprise');

        let result = await fetchFileFromContentsUrl("cicd.template.yml", "https://api.github.com/repos/Cythral/pipelines/contents");
        expect(result).toBeNull();
    });

    it("should return null if the contents url returns a non-200 response", async () => {
        fetch.mockReject();

        let result = await fetchFileFromContentsUrl("cicd.template.yml", "https://api.github.com/repos/Cythral/pipelines/contents");
        expect(result).toBeNull();
    });    
});

describe("fetchTemplate", () => {
    it("should return the cicd.template.yml file from the github contents url", async () => {
        let fileContents = "test file contents";
        let token = "fakeToken";
        fetch.mockResponse(mockContentsPayload(fileContents));

        let result = await fetchTemplate("https://api.github.com/repos/Cythral/pipelines/contents", token);
        expect(result).toBe("test file contents");
        expect(fetch).toHaveBeenCalledWith(
            "https://api.github.com/repos/Cythral/pipelines/contents/cicd.template.yml",
            {
                headers: {
                    Authorization: `token ${token}`
                }
            }
        );
    });

    it("should return null if cicd.template.yml does not exist in the repository", async () => {
        fetch.mockReject();
        let token = "fakeToken";
        let result = await fetchTemplate("https://api.github.com/repos/Cythral/pipelines/contents", token);
        expect(result).toBeNull();
    });
});

describe("fetchConfig", () => {
    it("should return the cicd.config.json file from the contents url", async () => {
        let fileContents = '{"configKey":"configValue"}';
        let token = "fakeToken";
        fetch.mockResponse(mockContentsPayload(fileContents)); 
        let result = await fetchConfig("https://api.github.com/repos/Cythral/pipelines/contents", token);
        
        expect(result).toMatchObject({
            configKey: "configValue"
        });

        expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/Cythral/pipelines/contents/cicd.config.json", {
            headers: {
                Authorization: `token ${token}`
            }
        });
    });

    it("should return an object if cicd.config.json does not exist", async () => {
        fetch.mockReject();
        let result = await fetchConfig("https://api.github.com/repos/Cythral/pipelines/contents");
        expect(result).toBeNull();
    });

    it("should return the cicd.config.json file with Parameters transformed from { key: value } into [ { ParameterKey: key, ParameterValue: value } ]", async () => {
        let fileContents = JSON.stringify({
            Parameters: {
                key: "value"
            }
        });

        fetch.mockResponse(mockContentsPayload(fileContents));
        let result = await fetchConfig("https://api.github.com/repos/Cythral/pipelines/contents");

        expect(result).toMatchObject({
            Parameters: [
                {
                    ParameterKey: "key",
                    ParameterValue: "value"
                }
            ]
        });
    });

    it("should return the cicd.config.json file with Tags transformed from { key: value } into [ { Key: key, Value: value } ]", async () => {
        let fileContents = JSON.stringify({
            Tags: {
                key: "value"
            }
        });

        fetch.mockResponse(mockContentsPayload(fileContents));
        let result = await fetchConfig("https://api.github.com/repos/Cythral/pipelines/contents");

        expect(result).toMatchObject({
            Tags: [
                {
                    Key: "key",
                    Value: "value"
                }
            ]
        });
    });

    it("should stringify the StackPolicy key from cicd.config.json and replace its key with StackPolicyBody", async () => {
        let fileContents = JSON.stringify({
            StackPolicy: {
                Statement: []
            }
        });

        fetch.mockResponse(mockContentsPayload(fileContents));
        let result = await fetchConfig("https://api.github.com/repos/Cythral/pipelines/contents");

        expect(result).toMatchObject({
            StackPolicyBody: '{"Statement":[]}'
        });
    });
});