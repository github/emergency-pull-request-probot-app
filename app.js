const axios = require('axios');

/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("Yay! The app was loaded!");

  app.on("pull_request.labeled", async (context) => {
    if (context.payload.label.name == "emergency") {
      app.log("Emergency label detected");
      context.octokit.pulls.createReview(
        context.pullRequest({ event: "APPROVE", body: "Emergency PR approved" })
      );
      return axios({
        method: 'put',
        url: `${context.payload.pull_request.url}/merge`,
        auth: {
          username: process.env.GITHUB_USER,
          password: process.env.GITHUB_PAT
        }
      });
    }
  });
};
