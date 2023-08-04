# Emergency PR GitHub App

This project is a probot app deploying to [AWS Lambda](https://aws.amazon.com/lambda/) using [aws sam](https://aws.amazon.com/serverless/sam/). The purpose of this app is to provide a way for developers to bypass approval and checks in order to merge an emergency change to the protected main branch while ensuring that this bypass doesn't go unnoticed by creating an issue and/or slack notification.

The app listens for [Pull Request events](https://docs.github.com/en/developers/webhooks-and-events/events/github-event-types#pullrequestevent) where action=`labeled` and can do 4 things:
1. Approve an emergency PR
1. Merge the emergency PR, bypassing approvals and checks
1. Create an issue to audit the emergency PR
1. Send notification via slack

Each of the above can be toggled on or off using the following environment variables which are meant to be self explanatory:
`APPROVE_PR, MERGE_PR, CREATE_ISSUE, SLACK_NOTIFY`
Setting each of the above to `true` will enable the feature. Any other value will disable the feature.

To configure the emergency label this app is looking for, set `EMERGENCY_LABEL` env var.

The issue this app will create can be configured by setting the `ISSUE_TITLE`, and `ISSUE_BODY_FILE`. The `ISSUE_BODY_FILE` is a markdown file used to create the issue. The # in that file will be replaced with a link to the PR and display the PR#. That link will look like this...  
[#19](https://github.com/robandpdx-volcano/superbigmono/pull/19)

The slack notification can be configured by setting the `SLACK_MESSAGE_FILE`. There are some dynamic replacements in this file that occur before the message is sent:
 - `#pr` is replaced with the url to the pull request
 - `#l` is replaced with the label configured in `EMERGENCY_LABEL`
 - `#i` is replaced with the url to the issue created, if issue creation is enabled
## Environment setup
### Create GitHub App
Create the GH App in your org or repo. Define a client secrent. Generate a private key.
#### Grant repository permissions
Set Contents access to `Read & write`
Set Issues access to `Read & write`  
Set Pull Requests access to `Read & write`  
#### Subscripe to events
Check `Issues`  
Check `Issue comment`  
Check `Pull request`

#### Allow app to bypass branch protection
If you want the app to merge the emergency PR, and have configured "Require status checks to pass before merging" in your branch protection rule, you will need to allow the app to bypass branch protection.

If you want the app to merge the emergency PR, and have configured "Restrict who can push to matching branches" in your branch projection rule, you will need to allow the app push access to the matching branches.

Once you have the bot user setup and the GitHub app configured you are ready to deploy!

### Create a Slack App
1. Navigate to your slack workspace `https://<workspace-name>.slack.com/home`
1. In the menu on the left, under `Other`, click the `API` link
1. Click `Create an app`
1. Create the app using the manifest file emergency-pr-manifest.yml
## Deployment
Get the following details about your GitHub app:
- `APP_ID`
- `WEBHOOK_SECRET`
- `PRIVATE_KEY` (base64 encoded)

You will need to base64 encode the private key.

You will also need a user and PAT with admin permissions on the repos in order to merge bypassing checks and required approvals. These will be supplied to the app as the following env vars:
- `GITHUB_USER`
- `GITHUB_PAT`

Get the following details about your Slack app:
- `SLACK_BOT_TOKEN`

Also go find the `SLACK_CHANNEL_ID` for the channel you want to send notifications to.  
You will need to configure the contents of the slack message by setting value of `SLACK_MESSAGE_FILE` and editing the contents of that file.

You will need to decide the label that this app looks for, the contents of the issue, and the assignee of the issue:
- `EMERGENCY_LABEL`  This is the label that indicates an emergency PR
- `ISSUE_TITLE`  This is the title of the issue created
- `ISSUE_BODY_FILE`  This is the file containing the body of the issue created
- `ISSUE_ASSIGNEES`  This is a comma separated list of the issue assignees

To make the emergency label permanent set `EMERGENCY_LABEL_PERMANENT` to true. Doing this will cause the app to reapply the emergency label if it is removed.
To trigger the label (and therefore everything configured) set `TRIGGER_STRING` to the value you want the app to look for in PRs and PR comments.

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

Copy .env-sample to .env and fill in the environment variables as needed. See above.

Start the server

```
npm start
```

Follow the instructions to register a new GitHub app.

## Docker

```sh
# 1. Run npm install
npm install

# 2. Build container
docker build -t emergency-pull-request .

# 3. Srouce your .env file
export $(cat .env | xargs)

# 3. Start container
docker run \
    -e APP_ID=$APP_ID \
    -e PRIVATE_KEY=$PRIVATE_KEY \
    -e WEBHOOK_SECRET=$WEBHOOK_SECRET \
    -e GITHUB_PAT=$GITHUB_PAT \
    -e GITHUB_USER=$GITHUB_USER \
    -e APPROVE_PR=$APPROVE_PR \
    -e CREATE_ISSUE=$CREATE_ISSUE \
    -e MERGE_PR=$MERGE_PR \
    -e ISSUE_TITLE=$ISSUE_TITLE \
    -e ISSUE_BODY_FILE=$ISSUE_BODY_FILE \
    -e ISSUE_ASSIGNEES=$ISSUE_ASSIGNEES \
    -e EMERGENCY_LABEL=$EMERGENCY_LABEL \
    emergency-pull-request
```

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
