import React from 'react';

export const VsCodeContext = React.createContext({
  postMessage: jest.fn(),
  getState: jest.fn(() => ({})),
  setState: jest.fn()
});
