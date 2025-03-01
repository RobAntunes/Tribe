module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/webview/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/webview/src/__mocks__/fileMock.js'
  },
  testMatch: ['<rootDir>/webview/src/**/*.test.(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'webview/tsconfig.json'
    }
  }
};
