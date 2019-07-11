const express = require("express");
const app = express();
const { handle } = require("./webhook");

const ENV = process.env.NODE_ENV || "production";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_SIGNING_SECRET = process.env.GITHUB_SIGNING_SECRET;
const PORT = process.env.PORT || 80;

function error(message) {
    console.error(message);
    process.exit(1);
}

void async function main() {
    if(typeof GITHUB_TOKEN === "undefined" || GITHUB_TOKEN === "") {
        error("Invalid Github OAuth Token.");
    }

    if(typeof GITHUB_SIGNING_SECRET === "undefined" || GITHUB_SIGNING_SECRET === "") {
        error("Invalid Github Signing Secret (token used to verify requests are coming from GitHub)");
    }

    app.post("*", async (request, response) => {
        try {
            let result = await handle(
                request.headers["x-github-event"],
                request.body,
                request.headers['x-hub-signature']
            );
            console.log(JSON.stringify(request.headers));
            response.status(200);
            response.write(result);
        } catch(error) {
            response.status(500);
            response.write(ENV === "production" ? "Internal Server Error" : error.toString());
            console.error(error.toString());
        }

        response.end();
    });

    app.listen(PORT);
}();