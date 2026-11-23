const { suite } = require("uvu");
const assert = require("uvu/assert");
const { rejects } = require("node:assert/strict");
const { createHmac, generateKeyPairSync } = require("node:crypto");
const nock = require("nock").default;
const { loadProbotEnv } = require("./credentials");

const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:github-app-AbCdEf";
const secret = {
  APP_ID: "123456",
  WEBHOOK_SECRET: "test-webhook-secret",
  PRIVATE_KEY: Buffer.from(generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }).privateKey).toString("base64"),
};
const envNames = [
  ...Object.keys(secret),
  "PRIVATE_KEY_PATH",
  "GITHUB_APP_SECRET_ARN",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
];
let savedEnv;

function secretResponse(body = { SecretString: JSON.stringify(secret) }, status = 200) {
  return nock("https://secretsmanager.us-east-1.amazonaws.com")
    .matchHeader("x-amz-target", "secretsmanager.GetSecretValue")
    .post("/", { SecretId: secretArn })
    .reply(status, body);
}

function webhookEvent(webhookSecret = secret.WEBHOOK_SECRET) {
  const body = JSON.stringify({ zen: "Test ping" });
  return {
    httpMethod: "POST",
    path: "/api/github/webhooks",
    headers: {
      "x-github-delivery": "test-delivery",
      "x-github-event": "ping",
      "x-hub-signature-256": `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`,
    },
    body,
  };
}

const test = suite("credentials");

test.before.each(() => {
  savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  process.env.AWS_REGION = "us-east-1";
  process.env.AWS_ACCESS_KEY_ID = "test-access-key";
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
  nock.disableNetConnect();
  delete require.cache[require.resolve("./handler")];
});

test.after.each(() => {
  const pendingMocks = nock.pendingMocks();
  nock.cleanAll();
  for (const name of envNames) {
    if (savedEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = savedEnv[name];
    }
  }
  delete require.cache[require.resolve("./handler")];
  assert.equal(pendingMocks, []);
});

test("uses a complete environment without contacting AWS even when an ARN is configured", async () => {
  const env = { ...secret, GITHUB_APP_SECRET_ARN: secretArn, LOG_LEVEL: "error" };
  assert.equal(await loadProbotEnv(env), env);
});

test("preserves environment-only and local setup behavior when no ARN is configured", async () => {
  const env = { APP_ID: "123456" };
  assert.equal(await loadProbotEnv(env), env);
});

test("loads all credentials without putting secret values in process.env", async () => {
  secretResponse();
  const env = { GITHUB_APP_SECRET_ARN: secretArn, LOG_LEVEL: "error" };
  assert.equal(await loadProbotEnv(env), { ...env, ...secret });
  assert.equal(env, { GITHUB_APP_SECRET_ARN: secretArn, LOG_LEVEL: "error" });
  for (const name of Object.keys(secret)) assert.is(process.env[name], undefined);
});

test("fills only missing or empty values and preserves environment overrides", async () => {
  secretResponse({ SecretString: JSON.stringify({
    WEBHOOK_SECRET: secret.WEBHOOK_SECRET,
    PRIVATE_KEY: secret.PRIVATE_KEY,
    LOG_LEVEL: "debug",
  }) });
  const env = {
    APP_ID: "654321",
    WEBHOOK_SECRET: "",
    GITHUB_APP_SECRET_ARN: secretArn,
    LOG_LEVEL: "error",
  };
  assert.equal(await loadProbotEnv(env), {
    ...env,
    WEBHOOK_SECRET: secret.WEBHOOK_SECRET,
    PRIVATE_KEY: secret.PRIVATE_KEY,
  });
});

test("propagates AWS access failures instead of falling back", async () => {
  secretResponse({ __type: "AccessDeniedException", message: "Access denied" }, 400);
  await rejects(loadProbotEnv({ GITHUB_APP_SECRET_ARN: secretArn }), {
    name: "AccessDeniedException",
  });
});

test("rejects malformed JSON without exposing its contents in the error", async () => {
  secretResponse({ SecretString: "sensitive-json-value" });
  await rejects(loadProbotEnv({ GITHUB_APP_SECRET_ARN: secretArn }), (error) => {
    assert.is(error.message, "GitHub App secret must contain valid JSON.");
    assert.not.match(error.stack, "sensitive-json-value");
    return true;
  });
});

test("rejects binary secrets and JSON values that are not objects", async () => {
  secretResponse({ SecretBinary: Buffer.from("binary secret").toString("base64") });
  await rejects(loadProbotEnv({ GITHUB_APP_SECRET_ARN: secretArn }), /JSON SecretString/);
  for (const value of [null, [], "not an object"]) {
    secretResponse({ SecretString: JSON.stringify(value) });
    await rejects(loadProbotEnv({ GITHUB_APP_SECRET_ARN: secretArn }), /JSON object/);
  }
});

test("rejects absent, empty, whitespace-only, or non-string required fields", async () => {
  for (const value of [undefined, "", "  ", 123456]) {
    secretResponse({ SecretString: JSON.stringify({ ...secret, APP_ID: value }) });
    await rejects(loadProbotEnv({ GITHUB_APP_SECRET_ARN: secretArn }), /non-empty string for APP_ID/);
  }
});

test("initializes Lambda once for concurrent and warm invocations using secret credentials", async () => {
  process.env.GITHUB_APP_SECRET_ARN = secretArn;
  const request = secretResponse();
  const { webhooks } = require("./handler");

  const responses = await Promise.all([
    webhooks(webhookEvent(), {}),
    webhooks(webhookEvent(), {}),
  ]);
  for (const response of responses) assert.is(response.statusCode, 200);
  assert.is((await webhooks(webhookEvent(), {})).statusCode, 200);
  assert.ok(request.isDone());
});

test("Lambda uses environment credentials and still verifies webhook signatures", async () => {
  Object.assign(process.env, secret, { GITHUB_APP_SECRET_ARN: secretArn });
  const { webhooks } = require("./handler");

  assert.is((await webhooks(webhookEvent(), {})).statusCode, 200);
  await rejects(webhooks(webhookEvent("wrong-webhook-secret"), {}), /signature/i);
});

test("retries initialization on the next invocation after a secret lookup failure", async () => {
  process.env.GITHUB_APP_SECRET_ARN = secretArn;
  secretResponse({ __type: "AccessDeniedException", message: "Access denied" }, 400);
  const { webhooks } = require("./handler");
  await rejects(webhooks(webhookEvent(), {}), { name: "AccessDeniedException" });

  secretResponse();
  assert.is((await webhooks(webhookEvent(), {})).statusCode, 200);
});

test.run();
