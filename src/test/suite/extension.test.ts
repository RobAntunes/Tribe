/* eslint-disable header/header */
import '@testing-library/jest-dom';
import * as vscode from 'vscode';
import { CrewPanelProvider } from '../../../webview/src/panels/crew_panel/CrewPanelProvider';

describe('Extension Test Suite', () => {
  let context: vscode.ExtensionContext;

  beforeAll(async () => {
    // Get the test extension context
    const ext = vscode.extensions.getExtension('MightyDev.tribe');
    if (!ext) {
      throw new Error('Extension not found');
    }
    await ext.activate();
    context = (global as any).testContext;
  });

  it('Extension should be present', () => {
    expect(vscode.extensions.getExtension('MightyDev.tribe')).toBeTruthy();
  });

  it('Should activate extension', async () => {
    const ext = vscode.extensions.getExtension('MightyDev.tribe');
    await ext?.activate();
    expect(ext?.isActive).toBeTruthy();
  });

  it('Should register commands', async () => {
    const commands = await vscode.commands.getCommands();
    expect(commands).toContain('tribe.showCrewPanel');
    expect(commands).toContain('tribe.generateFlow');
    expect(commands).toContain('tribe.executeFlow');
  });

  it('Should create webview panel', async () => {
    const provider = new CrewPanelProvider(context.extensionUri, context);
    expect(provider).toBeTruthy();
  });

  it('Should handle flow generation', async () => {
    const result = await vscode.commands.executeCommand('tribe.generateFlow', {
      prompt: 'Create a new React component'
    });
    expect(result).toBeTruthy();
  });

  it('Should handle flow execution', async () => {
    const result = await vscode.commands.executeCommand('tribe.executeFlow', {
      flowId: 'test-flow',
      parameters: {}
    });
    expect(result).toBeTruthy();
  });
});
