const { suite } = require("uvu");
const assert = require("uvu/assert");

const nock = require("nock");
nock.disableNetConnect();

const {
  Probot,
  ProbotOctokit,
} = require("@probot/adapter-aws-lambda-serverless");

const payload = {
  loadName: "payload",
  name: "pull_request",
  id: "1",
  payload: {
    action: "labeled",
    label: {
      name: "emergency"
    },
    repository: {
      owner: {
        login: "robandpdx",
      },
      name: "superbigmono",
      url: "https://api.github.com/repos/robandpdx/superbigmono"
    },
    pull_request: {
      number: 1,
      url: "https://api.github.com/repos/robandpdx/superbigmono/pulls/1",
      html_url: "https://github.com/robandpdx/superbigmono/pull/1",
      merged: false
    },
  },
}

const payloadUnlabeled = {
  loadName: "payloadUnlabeled",
  name: "pull_request",
  id: "1",
  payload: {
    action: "unlabeled",
    label: {
      name: "emergency"
    },
    pull_request: {
      number: 1,
      issue_url: "https://api.github.com/repos/robandpdx/superbigmono/issues/1",
      html_url: "https://github.com/robandpdx/superbigmono/pull/1",
    },
    repository: {
      owner: {
        login: "robandpdx",
      },
      name: "superbigmono"
    },
  },
}

const payloadIssueUnlabeled = {
  loadName: "payloadIssueUnlabeled",
  name: "issues",
  id: "1",
  payload: {
    action: "unlabeled",
    label: {
      name: "emergency"
    },
    issue: {
      url: "https://api.github.com/repos/robandpdx/superbigmono/issues/1",
      html_url: "https://github.com/robandpdx/superbigmono/pull/1",
    },
    pull_request: {
      number: 1,
    },
    repository: {
      owner: {
        login: "robandpdx",
      },
      name: "superbigmono"
    },
  },
}

const payloadPrOpened = {
  loadName: "payloadPrOpened",
  name: "pull_request",
  id: "1",
  payload: {
    action: "opened",
    pull_request: {
      number: 1,
      body: "We need an Emergency landing - this bug is critical!",
      issue_url: "https://api.github.com/repos/robandpdx/superbigmono/issues/1",
      html_url: "https://github.com/robandpdx/superbigmono/pull/1",
    },
    repository: {
      owner: {
        login: "robandpdx",
      },
      name: "superbigmono"
    },
  }
}

const payloadPrComment = {
  loadName: "payloadPrComment",
  name: "issue_comment",
  id: "1",
  payload: {
    action: "created",
    issue: {
      url:  "https://api.github.com/repos/robandpdx/superbigmono/issues/1",
      pull_request: {
        html_url: "https://github.com/robandpdx/superbigmono/pull/1"
      }
    },
    comment: {
      body: "We need an Emergency landing - this bug is critical!"
    },
    pull_request: {
      number: 1,
    },
    repository: {
      owner: {
        login: "robandpdx",
      },
      name: "superbigmono"
    },
  }
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
  process.env.TRIGGER_STRING = 'emergency landing';
  process.env.SLACK_SIGNING_SECRET="fake-signing-secret";
  process.env.SLACK_BOT_TOKEN="xoxb-fake-bot-token";
  process.env.SLACK_CHANNEL_ID="fake-channel-id";

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
  delete process.env.SLACK_NOTIFY;
  delete process.env.SLACK_MESSAGE_FILE;
  delete process.env.EMERGENCY_LABEL_PERMANENT;
});

// This test sends a payload that is not an emergency label
test("recieves pull_request.labeled event, does nothing because not emergency label", async function () {
  await probot.receive({
    name: "pull_request",
    id: "1",
    payload: {
      action: "labeled",
      label: {
        name: "other"
      },
    },
  });
});

// This test will do all 4 things: approve, create issue, merge, and send slack notification
test("recieves pull_request.labeled event, approve, create issue, merge, slack notify", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';
  process.env.SLACK_NOTIFY = 'true';
  process.env.SLACK_MESSAGE_FILE = 'slackMessage.txt';
  
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
  ).reply(200, {
    html_url: "https://github.com/robandpdx/superbigmono/issues/44",
  });
  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);
  // mock the request to send the slack notification
  const mockSlack = nock("https://slack.com")
    .post("/api/chat.postMessage",
    (requestBody) => {
      //console.log(requestBody);
      checkSlackNotifyRequest(requestBody);
      return true;
    }
    ).reply(200, {
      ok: true,
      channel: "C1H9RESGL",
      ts: "1503435956.000247",
      message: {
          text: "Here's a message for you",
          username: "ecto1",
          bot_id: "B19LU7CSY",
          attachments: [
              {
                  text: "This is an attachment",
                  id: 1,
                  fallback: "This is an attachment's fallback"
              }
          ],
          type: "message",
          subtype: "bot_message",
          ts: "1503435956.000247"
      }
    });

  await probot.receive(payload);
  assert.equal(mock.pendingMocks(), []);
  assert.equal(mockSlack.pendingMocks(), []);
});

// This test will only approve the PR
test("recieves pull_request.labeled event, approve PR", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'false';
  process.env.MERGE_PR = 'false';
  process.env.SLACK_NOTIFY = 'false';

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

  await probot.receive(payload);
  assert.equal(mock.pendingMocks(), []);
});

// This test will only create an issue
test("recieves pull_request.labeled event, create issue", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'false';
  process.env.SLACK_NOTIFY = 'false';

  // mock the request to create the an issue
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues",
      (requestBody) => {
        checkIssueRequest(requestBody);
        return true;
      }
    )
    .reply(200);

  await probot.receive(payload);
  assert.equal(mock.pendingMocks(), []);
});

// This test will only create an issue without assingees
test("recieves pull_request.labeled event, create issue no assignees", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'false';
  process.env.SLACK_NOTIFY = 'false';
  delete process.env.ISSUE_ASSIGNEES

  // mock the request to create the an issue
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues",
      (requestBody) => {
        checkIssueNoAssigneesRequest(requestBody);
        return true;
      }
    )
    .reply(200);

  await probot.receive(payload);
  assert.equal(mock.pendingMocks(), []);
});

// This test will only merge the PR
test("recieves pull_request.labeled event, merge the PR", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'false';
  process.env.MERGE_PR = 'true';
  process.env.SLACK_NOTIFY = 'false';
  
  // mock the request to add approval to the pr
  const mock = nock("https://api.github.com")
    .put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  await probot.receive(payload);
  assert.equal(mock.pendingMocks(), []);
});

// This test will only slack notify
test("recieves pull_request.labeled event, slack notify", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'false';
  process.env.MERGE_PR = 'false';
  process.env.SLACK_NOTIFY = 'true';
  process.env.SLACK_MESSAGE_FILE = 'slackMessageNoIssue.txt';
  
  // mock the request to send the slack notification
  const mockSlack = nock("https://slack.com")
    .post("/api/chat.postMessage",
    (requestBody) => {
      //console.log(requestBody);
      checkSlackNotifyRequestNoIssue(requestBody);
      return true;
    }
    ).reply(200, {
      ok: true,
      channel: "C1H9RESGL",
      ts: "1503435956.000247",
      message: {
          text: "Here's a message for you",
          username: "ecto1",
          bot_id: "B19LU7CSY",
          attachments: [
              {
                  text: "This is an attachment",
                  id: 1,
                  fallback: "This is an attachment's fallback"
              }
          ],
          type: "message",
          subtype: "bot_message",
          ts: "1503435956.000247"
      }
    });

  await probot.receive(payload);
  assert.equal(mockSlack.pendingMocks(), []);
});

// This test will only slack notify (fail)
test("recieves pull_request.labeled event, slack notify (fail)", async function () {
  process.env.APPROVE_PR = 'false';
  process.env.CREATE_ISSUE = 'false';
  process.env.MERGE_PR = 'false';
  process.env.SLACK_NOTIFY = 'true';
  process.env.SLACK_MESSAGE_FILE = 'slackMessageNoIssue.txt';
  process.env.SLACK_RETYRY_CONFIG = '0';
  
  // mock the request to send the slack notification
  const mockSlack = nock("https://slack.com")
    .post("/api/chat.postMessage",
    (requestBody) => {
      //console.log(requestBody);
      checkSlackNotifyRequestNoIssue(requestBody);
      return true;
    }
    ).reply(500);

    try {
      await probot.receive(payload);
    } catch (err) {
      assert.equal(mockSlack.pendingMocks(), []);
      assert.equal(err.errors[0][0].message, "An HTTP protocol error occurred: statusCode = 500");
      assert.equal(err.errors[0].length, 1);
      return;
    }
});

// This test will do 3 things: approve, create issue, merge, but the appoval will fail
test("recieves pull_request.labeled event, approve (fails), create issue, merge", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';
  process.env.SLACK_NOTIFY = 'false';
  
  // mock the request to add approval to the pr
  const mock = nock("https://api.github.com")
    .post(
      "/repos/robandpdx/superbigmono/pulls/1/reviews",
      (requestBody) => {
        checkApprovalRequest(requestBody);
        return true;
      }
    )
    .replyWithError('something awful happened');
  // mock the request to create the an issue
  mock.post("/repos/robandpdx/superbigmono/issues",
    (requestBody) => {
      checkIssueRequest(requestBody);
      return true;
    }
  ).reply(200);
  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  try {
    await probot.receive(payload);
  } catch (err) {
    assert.equal(mock.pendingMocks(), []);
    assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/pulls/1/reviews failed, reason: something awful happened");
    assert.equal(err.errors[0].length, 1);
    return;
  }
});

// This test will do 3 things: approve, create issue, merge, but creating the issue will fail
test("recieves pull_request.labeled event, approve, create issue (fails), merge", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';
  process.env.SLACK_NOTIFY = 'false';
  
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
  ).replyWithError('something awful happened');
  // mock the request to merge the pr
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").reply(200);

  try {
    await probot.receive(payload);
  } catch (err) {
    assert.equal(mock.pendingMocks(), []);
    assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/issues failed, reason: something awful happened");
    assert.equal(err.errors[0].length, 1);
    return;
  }
});

// This test will do 3 things: approve, create issue, merge, but merging the PR will fail
test("recieves pull_request.labeled event, approve, create issue, merge (fails)", async function () {
  process.env.APPROVE_PR = 'true';
  process.env.CREATE_ISSUE = 'true';
  process.env.MERGE_PR = 'true';
  process.env.SLACK_NOTIFY = 'false';
  
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
  mock.put("/repos/robandpdx/superbigmono/pulls/1/merge").replyWithError('something awful happened')

  try {
    await probot.receive(payload);
  } catch (err) {
    assert.equal(mock.pendingMocks(), []);
    assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/pulls/1/merge failed, reason: something awful happened");
    assert.equal(err.errors[0].length, 1);
    return;
  }
});

// This test will reapply the emergency label to a PR
test("recieves pull_request.unlabeled event, reapply emergency label", async function () {
  process.env.EMERGENCY_LABEL_PERMANENT = 'true';
  // mock the request to reapply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .reply(200);

  await probot.receive(payloadUnlabeled);
  assert.equal(mock.pendingMocks(), []);
});

// This test will fail to reapply the emergency label to a PR
test("recieves pull_request.unlabeled event, fail to reapply emergency label", async function () {
  process.env.EMERGENCY_LABEL_PERMANENT = 'true';
  // mock the request to reapply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .replyWithError('something awful happened');

  try {
    await probot.receive(payloadUnlabeled);
  } catch (err) {
    assert.equal(mock.pendingMocks(), []);
    assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/issues/1/labels failed, reason: something awful happened");
    assert.equal(err.errors[0].length, 1);
    return;
  }
  assert.equal(mock.pendingMocks(), []);
});

// This test will not reapply the emergency label to a PR
test("recieves pull_request.unlabeled event, dont't emergency label", async function () {
  delete process.env.EMERGENCY_LABEL_PERMANENT;
  process.env.EMERGENCY_LABEL_PERMANENT = 'false';
  await probot.receive(payloadUnlabeled);
});

// This test will reapply the emergency label to an issue
test("recieves issue.unlabeled event, reapply emergency label", async function () {
  process.env.EMERGENCY_LABEL_PERMANENT = 'true';
  // mock the request to reapply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .reply(200);

  await probot.receive(payloadIssueUnlabeled);
  assert.equal(mock.pendingMocks(), []);
});

// This test will fail to reapply the emergency label to an issue
test("recieves issue.unlabeled event, fail to reapply emergency label", async function () {
  process.env.EMERGENCY_LABEL_PERMANENT = 'true';
  // mock the request to reapply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .replyWithError('something awful happened');

  try {
    await probot.receive(payloadIssueUnlabeled);
  } catch (err) {
    assert.equal(mock.pendingMocks(), []);
    assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/issues/1/labels failed, reason: something awful happened");
    assert.equal(err.errors[0].length, 1);
    return;
  }
  assert.equal(mock.pendingMocks(), []);
});

// This test will not reapply the emergency label to an issue
test("recieves pull_request.unlabeled event, dont't emergency label", async function () {
  delete process.env.EMERGENCY_LABEL_PERMANENT;
  process.env.EMERGENCY_LABEL_PERMANENT = 'false';
  await probot.receive(payloadIssueUnlabeled);
});

// This test will apply the emergency label based on the PR contents
test("recieves pull_request.opened event, applies emergency label", async function () {
  // mock the request to apply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .reply(200);

  await probot.receive(payloadPrOpened);
  assert.equal(mock.pendingMocks(), []);
});

// This test will fail to apply the emergency label based on the PR contents
test("recieves pull_request.opened event, fails to apply emergency label", async function () {
  // mock the request to apply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .replyWithError('something awful happened');

    try {
      await probot.receive(payloadPrOpened);
    } catch (err) {
      assert.equal(mock.pendingMocks(), []);
      assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/issues/1/labels failed, reason: something awful happened");
      assert.equal(err.errors[0].length, 1);
      return;
    }
});

// This test will not reapply the emergency label because the TRIGGER_STRING is not found
test("recieves pull_request.unlabeled event, dont't emergency label", async function () {
  delete process.env.TRIGGER_STRING;
  await probot.receive(payloadPrOpened);
});

// This test will apply the emergency label based on the contents of a comment on the PR
test("recieves issue_comment.created event, applies emergency label", async function () {
  // mock the request to apply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .reply(200);

  await probot.receive(payloadPrComment);
  assert.equal(mock.pendingMocks(), []);
});

// This test will fail to apply the emergency label based on the contents of a comment on the PR
test("recieves issue_comment.created event, failes to apply emergency label", async function () {
  // mock the request to apply the emergency label
  const mock = nock("https://api.github.com")
    .post("/repos/robandpdx/superbigmono/issues/1/labels",
      (requestBody) => {
        assert.equal(requestBody[0], "emergency");
        return true;
      }
    )
    .replyWithError('something awful happened');

    try {
      await probot.receive(payloadPrComment);
    } catch (err) {
      assert.equal(mock.pendingMocks(), []);
      assert.equal(err.errors[0][0].message, "request to https://api.github.com/repos/robandpdx/superbigmono/issues/1/labels failed, reason: something awful happened");
      assert.equal(err.errors[0].length, 1);
      return;
    }
});

// This test will not reapply the emergency label because the TRIGGER_STRING is not found
test("recieves issue_comment.created event, dont't emergency label", async function () {
  delete process.env.TRIGGER_STRING;
  await probot.receive(payloadPrComment);
});

function checkIssueRequest(requestBody) {
  assert.equal(requestBody.title, "Emergency PR Audit");
  assert.equal(requestBody.assignees, ["tonyclifton", "andykaufman"]);
  assert.equal(requestBody.labels, ["emergency"]);
  assert.equal(requestBody.body, "Pull request https://github.com/robandpdx/superbigmono/pull/1 was labeled as an emergency.\n- [ ] Reviewed");
}

function checkIssueNoAssigneesRequest(requestBody) {
  assert.equal(requestBody.title, "Emergency PR Audit");
  assert.equal((typeof requestBody.assignees), 'undefined');
  assert.equal(requestBody.labels, ["emergency"]);
  assert.equal(requestBody.body, "Pull request https://github.com/robandpdx/superbigmono/pull/1 was labeled as an emergency.\n- [ ] Reviewed");
}

function checkApprovalRequest(requestBody) {
  assert.equal(requestBody.event, "APPROVE");
}

function checkSlackNotifyRequest(requestBody) {
  assert.equal(requestBody.text, "<https://github.com/robandpdx/superbigmono/pull/1|Pull request> has been labeled as `emergency`\n<https://github.com/robandpdx/superbigmono/issues/44|Audit issue created>");
}

function checkSlackNotifyRequestNoIssue(requestBody) {
  assert.equal(requestBody.text, "<https://github.com/robandpdx/superbigmono/pull/1|Pull request> has been labeled as `emergency`");
}

test.run();
