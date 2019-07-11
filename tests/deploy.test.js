jest.mock("aws-sdk", () => {
    let CloudFormation = function() {};
    
    CloudFormation.prototype = {
        describeStacks: jest.fn(),
        createStack: jest.fn(),
        updateStack: jest.fn(),
    };

    return {
        CloudFormation
    };
});

class Response {
    constructor(value) {
        this.value = value;
    }

    promise() {
        if(this.value !== false) {
            return Promise.resolve(this.value);
        } else {
            return Promise.reject();
        }
    }
}

const { stackExists, deploy } = require("../src/deploy");
const aws = require("aws-sdk");

describe("stackExists", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        aws.CloudFormation.prototype.createStack.mockImplementation(() => new Response(true));
        aws.CloudFormation.prototype.updateStack.mockImplementation(() => new Response(true));
    });

    it("should return true if the stack exists", async () => {
        aws.CloudFormation.prototype.describeStacks.mockImplementation(() => {
            return new Response({
                Stacks: [
                    {
                        StackName: "Test"
                    }
                ]
            });
        });

        let result = await stackExists("Test");
        expect(result).toBe(true);
    });

    it("should return false if the stack does not exist", async () => {
        aws.CloudFormation.prototype.describeStacks.mockImplementation(() => {
            return new Response(false);
        });

        let result = await stackExists("Test");
        expect(result).toBe(false);
    });
});

describe("deploy", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        aws.CloudFormation.prototype.createStack.mockImplementation(() => new Response(true));
        aws.CloudFormation.prototype.updateStack.mockImplementation(() => new Response(true));
    });


    it("should call CloudFormation.createStack with OnFailure = DELETE if the stack does not exist", async () => {
        aws.CloudFormation.prototype.describeStacks.mockImplementation(() => {
            return new Response(false);
        });

        await deploy({ StackName: "Test" });
        expect(aws.CloudFormation.prototype.createStack).toHaveBeenCalledWith(expect.objectContaining({
            OnFailure: "DELETE"
        }));
    });

    it("should call CloudFormation.updateStack if the stack already exists", async () => {
        aws.CloudFormation.prototype.describeStacks.mockImplementation(() => {
            return new Response({
                Stacks: [{ StackName: "Test" }]
            });
        });

        await deploy({ StackName: "Test" });
        expect(aws.CloudFormation.prototype.updateStack).toHaveBeenCalled();
    });
});