const axios = require('axios');
const fs = require('fs')
const emergencyLabel = process.env.EMERGENCY_LABEL;
const reviewBody = process.env.REVIEW_BODY;
const auth = {
  username: process.env.GITHUB_USER,
  password: process.env.GITHUB_PAT
}

/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("Yay! The app was loaded!");

  app.on("pull_request.labeled", async (context) => {
    if (context.payload.label.name == "emergency") {
      app.log(`${emergencyLabel} label detected`);
      if (process.env.APPROVE_PR == 'true') {
        app.log(`Adding review to PR`);
        axios({
          method: 'post',
          url: `${context.payload.pull_request.url}/reviews`,
          auth: auth,
          data: { "event": "APPROVE" }
        })
      }
      if (process.env.CREATE_ISSUE == 'true') {
        app.log(`Creating issue`);
        let issueBody = fs.readFileSync(process.env.ISSUE_BODY_FILE, 'utf8');
        issueBody = issueBody.replace('#',context.payload.pull_request.html_url)
        axios({
          method: 'post',
          url: `${context.payload.repository.url}/issues`,
          auth: auth,
          data: { "title": process.env.ISSUE_TITLE, "body": issueBody }
        })
      }
      if (process.env.MERGE_PR == 'true') {
        app.log(`Merging PR`);
        return axios({
          method: 'put',
          url: `${context.payload.pull_request.url}/merge`,
          auth: auth
        });
      }
    }
  });
};
