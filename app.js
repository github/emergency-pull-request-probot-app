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
    if (context.payload.label.name == emergencyLabel) {
      app.log("Emergency label detected");
      context.octokit.pulls.createReview(
        context.pullRequest({ event: "APPROVE", body: reviewBody })
      );
      return axios({
        method: 'put',
        url: `${context.payload.pull_request.url}/merge`,
        auth: auth
      });
    }
  });
};
