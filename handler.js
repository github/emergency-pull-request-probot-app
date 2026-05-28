const {
  createLambdaFunction,
  createProbot,
  ProbotOctokit,
} = require("@probot/adapter-aws-lambda-serverless");

const appFn = require("./");

const Octokit = ProbotOctokit.defaults({
  userAgent: "emergency-pull-request-probot-app",
  request: {
    headers: {
      "X-GitHub-Api-Version": "2026-03-10",
    },
  },
});

module.exports.webhooks = createLambdaFunction(appFn, {
  probot: createProbot({ overrides: { Octokit } }),
});
