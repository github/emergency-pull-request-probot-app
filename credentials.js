const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const credentialNames = ["APP_ID", "WEBHOOK_SECRET", "PRIVATE_KEY"];

async function loadProbotEnv(env = process.env) {
  const missing = credentialNames.filter((name) => !env[name]);
  if (missing.length === 0 || !env.GITHUB_APP_SECRET_ARN) {
    return env;
  }

  const client = new SecretsManagerClient({});
  let response;
  try {
    response = await client.send(new GetSecretValueCommand({
      SecretId: env.GITHUB_APP_SECRET_ARN,
    }));
  } finally {
    client.destroy();
  }

  if (typeof response.SecretString !== "string") {
    throw new Error("GitHub App secret must contain a JSON SecretString.");
  }

  let secret;
  try {
    secret = JSON.parse(response.SecretString);
  } catch {
    // JSON parser errors can include the secret's contents.
    throw new Error("GitHub App secret must contain valid JSON.");
  }

  if (!secret || typeof secret !== "object" || Array.isArray(secret)) {
    throw new Error("GitHub App secret must contain a JSON object.");
  }

  const resolvedEnv = { ...env };
  for (const name of missing) {
    if (typeof secret[name] !== "string" || secret[name].trim() === "") {
      throw new Error(`GitHub App secret must contain a non-empty string for ${name}.`);
    }
    resolvedEnv[name] = secret[name];
  }

  return resolvedEnv;
}

module.exports = { loadProbotEnv };
