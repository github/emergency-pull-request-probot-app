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
  // set environmet variables used for all tests
  process.env.APP_ID = '999999';
  process.env.WEBHOOK_SECRET = 'fakesecret';
  process.env.PRIVATE_KEY = "fakeprivatekey";
  process.env.GITHUB_PAT = 'fakepat';
  process.env.GITHUB_USER = 'fake_user';
  process.env.ISSUE_TITLE = 'Emergency PR Audit';
  process.env.ISSUE_BODY_FILE = 'issueBody.md';
  process.env.ISSUE_ASSIGNEES = 'tonyclifton,andykaufman';
  process.env.EMERGENCY_LABEL = 'emergency';
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

test.after.each(() => {
  delete process.env.APPROVE_PR;
  delete process.env.CREATE_ISSUE;
  delete process.env.MERGE_PR;
});

test("recieves pull_request.labeled event, review, issue, merge", async function () {
    process.env.APPROVE_PR = 'true';
    process.env.CREATE_ISSUE = 'true';
    process.env.MERGE_PR = 'true';

  const mock = nock("https://api.github.com")
    // create new check run
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews",
      (requestBody) => {
        //console.log(requestBody);
        assert.equal(requestBody.event, "APPROVE");
        return true;
      }
    )
    .reply(200);

  mock.post("/repos/robandpdx/superbigmono/issues",
    (requestBody) => {
      assert.equal(requestBody.title, "Emergency PR Audit");
      assert.equal(requestBody.assignees, ["tonyclifton", "andykaufman"]);
      assert.equal(requestBody.labels, ["emergency"]);
      assert.equal(requestBody.body, "Pull request https://github.com/robandpdx/superbigmono/pull/1 was labeled as an emergency.\n- [ ] Reviewed");
      return true;
    }
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
