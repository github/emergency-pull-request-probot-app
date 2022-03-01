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

  process.env.APP_ID = '999999'
  process.env.WEBHOOK_SECRET = 'fakesecret'
  process.env.PRIVATE_KEY = "fakeprivatekey"
  process.env.GITHUB_PAT = 'fakepat'
  process.env.GITHUB_USER = 'fake_user'
  process.env.APPROVE_PR = 'true'
  process.env.CREATE_ISSUE = 'true'
  process.env.MERGE_PR = 'true'
  process.env.ISSUE_TITLE = 'Emergency PR Audit'
  process.env.ISSUE_BODY_FILE = 'issueBody.md'
  process.env.ISSUE_ASSIGNEES = 'tonyclifton,andykaufman'
  process.env.EMERGENCY_LABEL = 'emergency'

  const mock = nock("https://api.github.com")
    // create new check run
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews"
    )
    .reply(200);

  mock.post("/repos/robandpdx/superbigmono/issues"
  )
    .reply(200);

  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge",
    (requestBody) => {
      //console.log(requestBody);
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

  assert.equal(mock.pendingMocks(), []);
});

test.run();
