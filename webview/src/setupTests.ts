import '@testing-library/jest-dom';

// Mock VS Code API
const mockPostMessage = jest.fn();
const mockGetState = jest.fn(() => ({}));
const mockSetState = jest.fn();

(global as any).acquireVsCodeApi = () => ({
  postMessage: mockPostMessage,
  getState: mockGetState,
  setState: mockSetState
});
