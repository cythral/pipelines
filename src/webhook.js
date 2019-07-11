const { verify } = require("./verification");
const { fetchTemplate, fetchConfig } = require("./fetch");
const { deploy } = require("./deploy");
const deepmerge = require("deepmerge");

const HANDLED_EVENTS = ["push"];
const EXPECTED_OWNER = "cythral";

const VerificationError = class extends Error {};
const InvalidJsonError = class extends Error {};
const UnhandledEventError = class extends Error {};
const NoContentsUrlError = class extends Error {};
const InvalidContentsUrlError = class extends Error {};

function getOwnerFromContentsUrl(contentsUrl) {
    let parts = contentsUrl
        .replace("https://api.github.com/repos/", "")
        .split("/");
    
    return parts[0].toLowerCase();
}

function validateAndRetrieveVars(
    event,
    payload,
    signature,
    secretKey = process.env.GITHUB_SIGNING_SECRET
) {
    let data, contentsUrl;

    if(!verify(payload, signature, secretKey)) {
        throw new VerificationError("Request did not come from GitHub");
    }

    try {
        data = JSON.parse(payload);
    } catch(error) {
        throw new InvalidJsonError("Request payload was not valid Json.");
    }

    if(!HANDLED_EVENTS.includes(event)) {
        throw new UnhandledEventError(`${event} is not a currently handled event`);
    }

    if(!data.repository || !data.repository.contents_url) {
        throw new NoContentsUrlError("Payload did not include a contents url");
    }

    contentsUrl = data.repository.contents_url;
    if(getOwnerFromContentsUrl(contentsUrl) !== EXPECTED_OWNER) {
        throw new InvalidContentsUrlError("Contents url was for a repository outside of Cythral");
    }

    return {
        data,
        contentsUrl,
        repoName: data.repository.name
    };
}

async function handle(
    event,
    payload, 
    signature, 
    secretKey = process.env.GITHUB_SIGNING_SECRET,
    githubToken = process.env.GITHUB_TOKEN
) {
    const { contentsUrl, repoName } = validateAndRetrieveVars(event, payload, signature, secretKey);
    let template = await fetchTemplate(contentsUrl);
    let config = (await fetchConfig(contentsUrl)) || {};

    config = deepmerge(config, {
        StackName: `${repoName}-cicd`,
        TemplateBody: template,
        Parameters: [
            {
                ParameterKey: "GithubToken",
                ParameterValue: githubToken 
            },
            {
                ParameterKey: "GithubOwner",
                ParameterValue: EXPECTED_OWNER
            },
            {
                ParameterKey: "GithubRepo",
                ParameterValue: repoName
            }
        ],
        Capabilities: [
            "CAPABILITY_IAM",
            "CAPABILITY_NAMED_IAM"
        ]
    });

    await deploy(config);
    return;
}

exports.handle = handle;
exports.validateAndRetrieveVars = validateAndRetrieveVars;
exports.VerificationError = VerificationError;
exports.InvalidJsonError = InvalidJsonError;
exports.UnhandledEventError = UnhandledEventError;
exports.NoContentsUrlError = NoContentsUrlError;
exports.InvalidContentsUrlError = InvalidContentsUrlError;