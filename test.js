const { suite } = require("uvu");
const assert = require("uvu/assert");

const nock = require("nock");
nock.disableNetConnect();

const {
  Probot,
  ProbotOctokit,
} = require("@probot/adapter-aws-lambda-serverless");

const app = require("./app");

/** @type {import('probot').Probot */
let probot;
const test = suite("app");
test.before.each(() => {
  probot = new Probot({
    // simple authentication as alternative to appId/privateKey
    githubToken: "test",
    // disable logs
    logLevel: "warn",
    // disable request throttling and retries
    Octokit: ProbotOctokit.defaults({
      throttle: { enabled: false },
      retry: { enabled: false },
    }),
  });
  probot.load(app);
});

test("recieves pull_request.labeled event", async function () {
  const mock = nock("https://api.github.com")
    // create new check run
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews",
      (requestBody) => {
        assert.equal(requestBody, { event: "APPROVE" });

        return true;
      }
    )
    .reply(200);

  await probot.receive({
    name: "pull_request",
    id: "1",
    payload: {
      action: "labeled",
      label: {
        name: "emergency"
      },
      repository: {
        owner: {
          login: "probot",
        },
        name: "superbigmono",
        url: "https://api.github.com/repos/robandpdx/superbigmono"
      },
      pull_request: {
        number: 1,
        url: "https://api.github.com/repos/robandpdx/superbigmono/pulls/1",
        html_url: "https://github.com/robandpdx/superbigmono/pull/1"
      },
    },
  });

  assert.equal(mock.activeMocks(), []);
});

test.run();
