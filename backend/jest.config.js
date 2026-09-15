module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/afterEnv.js'],
};
