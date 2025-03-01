import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import CrewPanel from './panels/crew_panel/CrewPanel';
import { getVsCodeApi } from './vscode';

// Create React context for VS Code API
export const VsCodeContext = React.createContext<ReturnType<typeof getVsCodeApi>>(getVsCodeApi());

// Initialize VS Code API before React starts
const vscode = getVsCodeApi();

// Ensure VS Code API is available globally
(window as any).vscode = vscode;

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <VsCodeContext.Provider value={vscode}>
      <CrewPanel />
    </VsCodeContext.Provider>
  </React.StrictMode>
);
