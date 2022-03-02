const axios = require('axios');
const fs = require('fs')
const auth = {
  username: process.env.GITHUB_USER,
  password: process.env.GITHUB_PAT
}

/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("Yay! The app was loaded!");
  const emergencyLabel = process.env.EMERGENCY_LABEL;

  app.on("pull_request.labeled", async (context) => {
    let errorsArray = [];
    let newIssue
    if (context.payload.label.name == "emergency") {
      app.log(`${emergencyLabel} label detected`);

      // Approve PR
      if (process.env.APPROVE_PR == 'true') {
        app.log(`Adding review to PR`);
        await axios({
          method: 'post',
          url: `${context.payload.pull_request.url}/reviews`,
          auth: auth,
          data: { "event": "APPROVE" }
        }).then(response => {
          app.log(`Review added`)
        }).catch(error => {
          app.log(`Error adding review: ${error}`)
          errorsArray.push(error);
        });
      }

      // Create issue
      if (process.env.CREATE_ISSUE == 'true') {
        app.log(`Creating issue`);
        let assignees = {};
        if (typeof process.env.ISSUE_ASSIGNEES !== 'undefined' && process.env.ISSUE_ASSIGNEES != "") {
          let assigneesArray = process.env.ISSUE_ASSIGNEES.split(",");
          assignees = {"assignees": assigneesArray.map(s => s.trim())};
        }
        let issueBody = fs.readFileSync(process.env.ISSUE_BODY_FILE, 'utf8');
        issueBody = issueBody.replace('#',context.payload.pull_request.html_url)
        await axios({
          method: 'post',
          url: `${context.payload.repository.url}/issues`,
          auth: auth,
          data: { 
            "title": process.env.ISSUE_TITLE,
            "body": issueBody,
            "labels": [emergencyLabel],
            ...assignees
          }
        }).then(response => {
          app.log(`Issue created`)
          newIssue = response.data.html_url;
        }).catch(error => {
          app.log(`Error creating issue: ${error}`)
          newIssue = 'Failed to create issue';
          errorsArray.push(error);
        });
      }

      // Merge PR
      if (process.env.MERGE_PR == 'true') {
        app.log(`Merging PR`);
        await axios({
          method: 'put',
          url: `${context.payload.pull_request.url}/merge`,
          auth: auth
        }).then(response => {
          app.log(`PR merged`)
        }).catch(error => {
          app.log(`Error merging PR: ${error}`)
          errorsArray.push(error);
        });
      }

      // Slack notify
      if (process.env.SLACK_NOTIFY == 'true') {
        let slackMessage = fs.readFileSync(process.env.SLACK_MESSAGE_FILE, 'utf8');
        slackMessage = slackMessage.replace('#pr',context.payload.pull_request.html_url);
        if (typeof newIssue !== 'undefined' && newIssue != "") {
          slackMessage = slackMessage.replace('#i',newIssue);
        }
        slackMessage = slackMessage.replace('#l',emergencyLabel);
        const { WebClient } = require('@slack/web-api');

        // Read a token from the environment variables
        const token = process.env.SLACK_BOT_TOKEN;

        // Initialize
        const web = new WebClient(token);

        // Send message
        await web.chat.postMessage({
          text: slackMessage,
          channel: process.env.SLACK_CHANNEL_ID
        });
      }

      // Return errors, or true if no errors
      if (errorsArray.length > 0) {
        app.log(`Errors: ${errorsArray}`);
        throw errorsArray;
      } else {
        return true;
      }
    }
  });
};
