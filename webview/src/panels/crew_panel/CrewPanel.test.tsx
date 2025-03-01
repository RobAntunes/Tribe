/// <reference types="jest" />

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CrewPanel from './CrewPanel';
import { VsCodeContext } from '../../index';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Users: () => <div data-testid="users-icon" />,
  MessageSquare: () => <div data-testid="message-square-icon" />,
  GitBranch: () => <div data-testid="git-branch-icon" />,
  Bell: () => <div data-testid="bell-icon" />,
  Brain: () => <div data-testid="brain-icon" />,
  PlayCircle: () => <div data-testid="play-circle-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Send: () => <div data-testid="send-icon" />,
  Menu: () => <div data-testid="menu-icon" />
}));

// Mock Tribe icon
jest.mock('../../icon/Tribe', () => ({
  __esModule: true,
  default: () => <div data-testid="tribe-icon" />
}));

// Mock Flow components
jest.mock('./components/FlowOutput', () => ({
  FlowOutput: ({ flow }: { flow: any }) => (
    <div data-testid="flow-output">
      {flow && (
        <>
          <div>Active Flow: {flow.flowType}</div>
          {flow.proposedChanges?.filesToModify?.map((file: any) => (
            <div key={file.path}>Modify: {file.path}</div>
          ))}
          <button>Accept Changes</button>
        </>
      )}
    </div>
  )
}));

jest.mock('./components/FlowVisualizer', () => ({
  FlowVisualizer: ({ flow }: { flow: any }) => (
    <div data-testid="flow-visualizer">
      {flow && (
        <>
          <div>{flow.name}</div>
          <div>Confidence: {flow.confidence}%</div>
        </>
      )}
    </div>
  )
}));

jest.mock('./components/ProjectChanges', () => ({
  ProjectChanges: ({ changes }: { changes: any }) => (
    <div data-testid="project-changes">
      {changes && <button>Accept Changes</button>}
    </div>
  )
}));

const mockPostMessage = jest.fn();
const mockVsCodeApi = {
  postMessage: mockPostMessage,
  getState: () => ({
    agents: [],
    selectedAgent: null,
    tasks: [],
    messages: [],
    activeFlow: null,
    suggestedFlows: [],
    pendingInstructions: [],
    selectedTab: 'flows'
  }),
  setState: () => {}
};

describe('CrewPanel', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it('renders without crashing', () => {
    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel />
      </VsCodeContext.Provider>
    );
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel />
      </VsCodeContext.Provider>
    );

    // Click on different tabs and verify content changes
    fireEvent.click(screen.getByText('Chat'));
    expect(screen.getByText('Select an agent to start chatting')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Flows'));
    expect(screen.getByText('Generate Flow')).toBeInTheDocument();
  });

  it('handles flow generation', async () => {
    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel />
      </VsCodeContext.Provider>
    );

    // Navigate to Flows tab
    fireEvent.click(screen.getByText('Flows'));

    // Enter flow description
    const input = screen.getByPlaceholderText('Describe what you want to do...');
    fireEvent.change(input, { target: { value: 'Test flow' } });

    // Click generate button
    fireEvent.click(screen.getByText('Generate'));

    // Verify message was sent to VS Code
    await waitFor(() => {
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'GENERATE_FLOW',
        payload: { requirements: 'Test flow', context: { currentFile: null } }
      });
    });
  });

  it('displays active flow when present', () => {
    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel activeFlow={{
          flowType: 'test-flow',
          result: null,
          state: null,
          visualizations: [{ type: 'text', content: 'Test visualization' }],
          proposedChanges: {
            filesToModify: [{ path: 'test.ts', content: 'content' }],
            filesToCreate: [],
            filesToDelete: []
          }
        }} />
      </VsCodeContext.Provider>
    );

    fireEvent.click(screen.getByText('Flows'));
    const activeFlowTitle = screen.getByText(/Active Flow: test-flow/);
    expect(activeFlowTitle).toBeInTheDocument();
    expect(screen.getByText(/Modify: test.ts/)).toBeInTheDocument();
  });

  it('handles accepting flow changes', () => {
    const mockFlow = {
      flowType: 'test-flow',
      result: null,
      state: null,
      visualizations: [],
      proposedChanges: {
        filesToModify: [{ path: 'test.ts', content: 'content' }],
        filesToCreate: [],
        filesToDelete: []
      }
    };

    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel activeFlow={mockFlow} />
      </VsCodeContext.Provider>
    );

    fireEvent.click(screen.getByText('Flows'));
    const acceptButton = screen.getByRole('button', { name: /Accept Changes/i });
    fireEvent.click(acceptButton);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'APPLY_CHANGES',
      payload: mockFlow.proposedChanges
    });
  });

  it('displays suggested flows', () => {
    const mockSuggestedFlows = [
      {
        id: '1',
        name: 'Test Flow',
        confidence: 80,
        description: 'A test flow',
        steps: [],
        context: {}
      }
    ];

    render(
      <VsCodeContext.Provider value={mockVsCodeApi}>
        <CrewPanel suggestedFlows={mockSuggestedFlows} />
      </VsCodeContext.Provider>
    );

    fireEvent.click(screen.getByText('Flows'));
    const flowTitle = screen.getByText(/Test Flow/);
    expect(flowTitle).toBeInTheDocument();
    const confidenceText = screen.getByText(/Confidence: 8000%/);
    expect(confidenceText).toBeInTheDocument();
  });
});
