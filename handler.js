const {
  createLambdaFunction,
  createProbot,
  ProbotOctokit,
} = require("@probot/adapter-aws-lambda-serverless");

const appFn = require("./");
const { loadProbotEnv } = require("./credentials");

const Octokit = ProbotOctokit.defaults({
  userAgent: "emergency-pull-request-probot-app",
  request: {
    headers: {
      "X-GitHub-Api-Version": "2026-03-10",
    },
  },
});

let lambdaFunction;

module.exports.webhooks = async (event, context) => {
  if (!lambdaFunction) {
    lambdaFunction = loadProbotEnv()
      .then((env) => createLambdaFunction(appFn, {
        probot: createProbot({ env, overrides: { Octokit } }),
      }))
      .catch((error) => {
        lambdaFunction = undefined;
        throw error;
      });
  }

  return (await lambdaFunction)(event, context);
};
