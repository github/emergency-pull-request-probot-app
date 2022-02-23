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
      app.log(`${emergencyLabel} label detected`);
      axios({
        method: 'post',
        url: `${context.payload.pull_request.url}/reviews`,
        auth: auth,
        data: {"event":"APPROVE"}
      })
      return axios({
        method: 'put',
        url: `${context.payload.pull_request.url}/merge`,
        auth: auth
      });
    }
  });
};
