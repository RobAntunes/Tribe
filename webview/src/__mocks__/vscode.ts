export const getVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
}));
