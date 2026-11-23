const { run } = require("@probot/adapter-aws-lambda-serverless");
const { config } = require("dotenv");
const { loadProbotEnv } = require("./credentials");

config({ quiet: true });

loadProbotEnv()
  .then((env) => run(process.argv, { env }))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
