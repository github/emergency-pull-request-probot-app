const { suite } = require("uvu");
const assert = require("uvu/assert");

const nock = require("nock");
nock.disableNetConnect();

const {
  Probot,
  ProbotOctokit,
} = require("@probot/adapter-aws-lambda-serverless");

const payload = {
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
}

const app = require("./app");

/** @type {import('probot').Probot */
let probot;
const test = suite("app");
test.before.each(() => {
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

test("recieves pull_request.labeled event, approve, create issue, merge", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';
  
  // mock the request to add approval to the pr
  const mock = nock("https://api.github.com")
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews",
      (requestBody) => {
        checkApprovalRequest(requestBody);
        return true;
      }
    )
    .reply(200);
  // mock the request to create the an issue
  mock.post("/repos/robandpdx/superbigmono/issues",
    (requestBody) => {
      checkIssueRequest(requestBody);
      return true;
    }
  ).reply(200);
  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  await probot.receive(payload);

  assert.equal(mock.pendingMocks(), []);
});

test("recieves pull_request.labeled event, create issue, merge", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';

  // mock the request to create the an issue
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues",
      (requestBody) => {
        checkIssueRequest(requestBody);
        return true;
      }
    )
    .reply(200);

  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  await probot.receive(payload);

  assert.equal(mock.pendingMocks(), []);
});

test("recieves pull_request.labeled event, approve, merge", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'false';
  process.env.MERGE_PR = 'true';

  // mock the request to add approval to the pr
  const mock = nock("https://api.github.com")
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews",
      (requestBody) => {
        //console.log(requestBody);
        checkApprovalRequest(requestBody);
        return true;
      }
    )
    .reply(200);

  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  await probot.receive(payload);

  assert.equal(mock.pendingMocks(), []);
});

function checkIssueRequest(requestBody) {
  assert.equal(requestBody.title, "Emergency PR Audit");
  assert.equal(requestBody.assignees, ["tonyclifton", "andykaufman"]);
  assert.equal(requestBody.labels, ["emergency"]);
  assert.equal(requestBody.body, "Pull request https://github.com/robandpdx/superbigmono/pull/1 was labeled as an emergency.\n- [ ] Reviewed");
}

function checkApprovalRequest(requestBody) {
  assert.equal(requestBody.event, "APPROVE");
}

test.run();
