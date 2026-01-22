import { getDefaultMapEditorToolId, getMapEditorTool } from './mapEditorTools';

describe('mapEditorTools', () => {
  it('getDefaultMapEditorToolId returns select', () => {
    expect(getDefaultMapEditorToolId()).toBe('select');
  });

  it('getMapEditorTool returns a tool definition for a known id', () => {
    const tool = getMapEditorTool('zoom');
    expect(tool.id).toBe('zoom');
    expect(tool.interactionMode).toBe('zoom');
    expect(tool.toolbarCommands.map((command) => command.id)).toEqual(['zoom/in', 'zoom/out', 'zoom/default']);
  });

  it('getMapEditorTool throws for an unknown id', () => {
    expect(() => getMapEditorTool('nope' as unknown as never)).toThrow('Unknown MapEditorToolId');
  });

  it('getMapEditorTool exposes room tool with template commands', () => {
    const tool = getMapEditorTool('room');
    expect(tool.id).toBe('room');
    expect(tool.interactionMode).toBe('room');
    expect(tool.toolbarCommands.map((command) => command.id)).toEqual(['room/rectangle', 'room/square', 'room/triangle']);
  });
});
