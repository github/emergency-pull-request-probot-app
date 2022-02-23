const axios = require('axios');
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
      let reviewBody = `Pull request ${context.payload.pull_request.html_url} was labeled as an emergency.
- [ ] Reviewed`;
      app.log(`${emergencyLabel} label detected`);
      axios({
        method: 'post',
        url: `${context.payload.pull_request.url}/reviews`,
        auth: auth,
        data: {"event":"APPROVE"}
      })
      axios({
        method: 'post',
        url: `${context.payload.repository.url}/issues`,
        auth: auth,
        data: {"title":"Emergency PR Audit","body":reviewBody}
      })
      return axios({
        method: 'put',
        url: `${context.payload.pull_request.url}/merge`,
        auth: auth
      });
    }
  });
};
