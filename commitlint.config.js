// Conventional Commits: https://www.conventionalcommits.org
// release-please reads these to pick the next version and write CHANGELOG.md:
// feat -> minor, fix/perf -> patch, "!" or "BREAKING CHANGE:" -> major (minor while < 1.0).
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', ['tracker', 'ui', 'sessions', 'blocker', 'reports', 'updater', 'store', 'build', 'ci', 'deps', 'docs', 'release']],
  },
};
