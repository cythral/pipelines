const fetch = require("node-fetch");

async function fetchFileFromContentsUrl(fileName, contentsUrl, githubToken = process.env.GITHUB_TOKEN) {
    try {
        contentsUrl = contentsUrl
            .replace("{+path}", "")
            .replace(/(.*)\/$/, "$1");

        let response = await fetch(contentsUrl + '/' + fileName, {
            headers: {
                Authorization: `token ${githubToken}`
            }
        });

        if(response.status === 404) {
            return null;
        }

        let payload = await response.json();
        return Buffer.from(payload.content, "base64").toString();
    } catch(error) {
        return null;
    }
}

async function fetchTemplate(contentsUrl, githubToken = process.env.GITHUB_TOKEN) {
    return await fetchFileFromContentsUrl("cicd.template.yml", contentsUrl, githubToken);
}

async function fetchConfig(contentsUrl, githubToken = process.env.GITHUB_TOKEN) {
    function transformKeyValuePairs(object, prefix = '') {
        if(typeof object !== "object") {
            return (Array.isArray(object)) ? object : [];
        }

        let result = [];
        for(let key in object) {
            let item = {};
            item[`${prefix}Key`] = key;
            item[`${prefix}Value`] = object[key];

            result.push(item);
        }
        return result;
    }

    try {
        let response = await fetchFileFromContentsUrl("cicd.config.json", contentsUrl, githubToken);
        let config = JSON.parse(response);
        
        config.Parameters = transformKeyValuePairs(config.Parameters, 'Parameter');
        config.Tags = transformKeyValuePairs(config.Tags);
        config.StackPolicyBody = typeof config.StackPolicy === "object" ? JSON.stringify(config.StackPolicy) : config.StackPolicyBody;
        delete config.StackPolicy;

        return config;
    } catch(error) {
        return null;
    }
}

exports.fetchFileFromContentsUrl = fetchFileFromContentsUrl;
exports.fetchTemplate = fetchTemplate;
exports.fetchConfig = fetchConfig;