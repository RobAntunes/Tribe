module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^./vscode$': '<rootDir>/src/__mocks__/vscode.ts',
    '^../../index$': '<rootDir>/src/__mocks__/index.tsx'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleDirectories: ['node_modules', 'src']
};
