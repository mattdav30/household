// Lets a build pick the API address from the environment, falling back to app.json.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, apiUrl: process.env.API_URL || config.extra.apiUrl },
});
