# Emergency PR GitHub App

This repository is a probot app to [AWS Lambda](https://aws.amazon.com/lambda/) using [aws sam](https://aws.amazon.com/serverless/sam/).

The app listens for [Pull Request events](https://docs.github.com/en/developers/webhooks-and-events/events/github-event-types#pullrequestevent) where action=`labeled` and can do 3 things:
1. Approve an emergency PR
1. Create an issue to audit the emergency PR
1. Merge the emergency PR, bypassing approvals and checks

Each of the above can be toggled on or off using the following environment variables which are meant to be self explanatory:
`APPROVE_PR, CREATE_ISSUE, MERGE_PR`
Setting each of the above to `true` will enable the feature. Any other value will disable the feature.

To configure the emergency label this app is looking for, set `EMERGENCY_LABEL` env var.

The issue this app will create can be configured by setting the ISSUE_TITLE, and ISSUE_BODY_FILE. The ISSUE_BODY_FILE is a markdown file used to create the issue. The # in that file will be replaced with a link to the PR and display the PR#. That link will look like this...  
[#19](https://github.com/robandpdx-volcano/superbigmono/pull/19)
## Environment setup
### Create Bot User
If you want the app to merge the emergency PR, and you have "Require status checks to pass before merging" in your branch protection, you will need to give the bot user `owner` permissions on the Org or repo.

If you do not have "Require status checks to pass before merging" you can make the bot user a standard user. If you also have more than 1 approval required you will need to configure the bot user in your branch protection section "Allow specified actors to bypass pull request requirements" in order to allow merging.

Generate a PAT for the bot user with repo scope. Configure SSO for the PAT, authorizing the PAT for your org.
### Create GitHub App
Create the GH App in your org or repo. Define a client secrent. Generate a private key. Subscripe to events and grant permissions.

Once you have the bot user setup and the GitHub app configured you are ready to deploy!
## Deployment
Get the following details about your GitHub app:
- `APP_ID`
- `WEBHOOK_SECRET`
- `PRIVATE_KEY`

You will need to base64 encode the private key.

You will also need a user and PAT with admin permissions on the repos in order to merge bypassing checks and required approvals. These will be supplied to the app as the following env vars:
- `GITHUB_USER`
- `GITHUB_PAT`

You will need to decide the label that this app looks for, the contents of the issue, and the assignee of the issue:
- `EMERGENCY_LABEL`  This is the label that indicates an emergency PR
- `ISSUE_TITLE`  This is the title of the issue created
- `ISSUE_BODY_FILE`  This is the file containing the body of the issue created
- `ISSUE_ASSIGNEES`  This is a comma separated list of the issue assignees

1. Setup your aws cli creds
1. set your aws profile by running `export AWS_PROFILE=<profile>`
1. run `sam build`
1. run `sam deploy --guided`
You will be prompted for inputs names similar to the environment variables above. 

Subsequent deploys to the same stack to the default environment...
1. run `sam build`
1. run `sam deploy`

## Local setup

Install dependencies

```
npm install
```

Start the server

```
npm start
```

Follow the instructions to register a new GitHub app.

## Debugging locally
There are two options to debug locally.

### Debug via unit tests
1. Intall nyc and mocha: `npm install -g nyc mocha`
1. From the VSCode `RUN AND DEBUG` menu select `Mocha` and click the green arrow to start debugging.

### Debug by launching probot locally and sending it a payload 

1. Point your GitHub app to your local using something like smee.io
1. Copy .env-sample to .env and populate with values specific for your GitHub app. For the `PRIVATE_KEY` replace newlines with `\\n` to make the string value a single line.
1. From the VSCode `RUN AND DEBUG` menu select `Launch Probot` and click the green arrow to start debugging.

## License

[ISC](LICENSE)
