import {
  formatToolHotkeyLabel,
  getToolHotkeyDescriptorForIndex,
  isEditableActiveElement,
  isElementEditable,
  parseToolIndexFromKeyboardEvent
} from './mapEditorToolHotkeys';

describe('mapEditorToolHotkeys', () => {
  describe('getToolHotkeyDescriptorForIndex', () => {
    it('returns null for invalid indices', () => {
      expect(getToolHotkeyDescriptorForIndex(-1)).toBeNull();
      expect(getToolHotkeyDescriptorForIndex(20)).toBeNull();
      expect(getToolHotkeyDescriptorForIndex(999)).toBeNull();
      expect(getToolHotkeyDescriptorForIndex(1.5)).toBeNull();
    });

    it('maps indices 0..9 to digits 1..0 without shift', () => {
      expect(getToolHotkeyDescriptorForIndex(0)).toEqual({ digit: '1', requiresShift: false });
      expect(getToolHotkeyDescriptorForIndex(8)).toEqual({ digit: '9', requiresShift: false });
      expect(getToolHotkeyDescriptorForIndex(9)).toEqual({ digit: '0', requiresShift: false });
    });

    it('maps indices 10..19 to digits 1..0 with shift', () => {
      expect(getToolHotkeyDescriptorForIndex(10)).toEqual({ digit: '1', requiresShift: true });
      expect(getToolHotkeyDescriptorForIndex(18)).toEqual({ digit: '9', requiresShift: true });
      expect(getToolHotkeyDescriptorForIndex(19)).toEqual({ digit: '0', requiresShift: true });
    });
  });

  describe('formatToolHotkeyLabel', () => {
    it('formats mac labels using symbols', () => {
      expect(formatToolHotkeyLabel({ digit: '1', requiresShift: false }, 'mac')).toBe('⌘1');
      expect(formatToolHotkeyLabel({ digit: '0', requiresShift: true }, 'mac')).toBe('⇧⌘0');
    });

    it('formats windows/linux labels using Ctrl+... text', () => {
      expect(formatToolHotkeyLabel({ digit: '1', requiresShift: false }, 'win-linux')).toBe('Ctrl+1');
      expect(formatToolHotkeyLabel({ digit: '0', requiresShift: true }, 'win-linux')).toBe('Ctrl+Shift+0');
    });
  });

  describe('parseToolIndexFromKeyboardEvent', () => {
    it('returns null when primary modifier is not held', () => {
      expect(
        parseToolIndexFromKeyboardEvent({ code: 'Digit1', shiftKey: false, metaKey: false, ctrlKey: false }, 'mac')
      ).toBeNull();
      expect(
        parseToolIndexFromKeyboardEvent(
          { code: 'Digit1', shiftKey: false, metaKey: false, ctrlKey: false },
          'win-linux'
        )
      ).toBeNull();
    });

    it('parses Digit codes (shift selects second bank)', () => {
      expect(parseToolIndexFromKeyboardEvent({ code: 'Digit1', shiftKey: false, metaKey: true, ctrlKey: false }, 'mac')).toBe(0);

      expect(parseToolIndexFromKeyboardEvent({ code: 'Digit0', shiftKey: false, metaKey: true, ctrlKey: false }, 'mac')).toBe(9);

      // Note: Shift+Digit1 commonly yields key '!' on many layouts; we intentionally parse via code.
      expect(parseToolIndexFromKeyboardEvent({ code: 'Digit1', shiftKey: true, metaKey: true, ctrlKey: false }, 'mac')).toBe(10);

      expect(parseToolIndexFromKeyboardEvent({ code: 'Digit0', shiftKey: true, metaKey: false, ctrlKey: true }, 'win-linux')).toBe(19);
    });

    it('returns null for non-digit codes', () => {
      expect(parseToolIndexFromKeyboardEvent({ code: 'KeyA', shiftKey: false, metaKey: true, ctrlKey: false }, 'mac')).toBeNull();
    });

    it('returns null when code looks like a digit prefix but is not a digit', () => {
      expect(
        parseToolIndexFromKeyboardEvent({ code: 'DigitA', shiftKey: false, metaKey: true, ctrlKey: false }, 'mac')
      ).toBeNull();
      expect(
        parseToolIndexFromKeyboardEvent(
          { code: 'NumpadA', shiftKey: false, metaKey: false, ctrlKey: true },
          'win-linux',
          { allowNumpad: true }
        )
      ).toBeNull();
    });

    it('optionally supports numpad digits', () => {
      const event = { code: 'Numpad2', shiftKey: false, metaKey: false, ctrlKey: true };
      expect(parseToolIndexFromKeyboardEvent(event, 'win-linux', { allowNumpad: true })).toBe(1);
      expect(parseToolIndexFromKeyboardEvent(event, 'win-linux', { allowNumpad: false })).toBeNull();
    });
  });

  describe('editable detection', () => {
    it('isElementEditable detects input/textarea/select and contenteditable', () => {
      expect(isElementEditable(null)).toBe(false);

      expect(isElementEditable({ tagName: 'INPUT' } as unknown as Element)).toBe(true);
      expect(isElementEditable({ tagName: 'TEXTAREA' } as unknown as Element)).toBe(true);
      expect(isElementEditable({ tagName: 'SELECT' } as unknown as Element)).toBe(true);

      expect(isElementEditable({ tagName: 'DIV', isContentEditable: true } as unknown as Element)).toBe(true);

      // When the property exists but is false, the helper must fall back to tagName detection.
      expect(isElementEditable({ tagName: 'INPUT', isContentEditable: false } as unknown as Element)).toBe(true);
      expect(isElementEditable({ tagName: 'DIV', isContentEditable: false } as unknown as Element)).toBe(false);

      expect(isElementEditable({ tagName: 'BUTTON' } as unknown as Element)).toBe(false);
    });

    it('isEditableActiveElement reflects the document active element', () => {
      const docWithInput = { activeElement: { tagName: 'INPUT' } as unknown as Element };
      expect(isEditableActiveElement(docWithInput)).toBe(true);

      const docWithButton = { activeElement: { tagName: 'BUTTON' } as unknown as Element };
      expect(isEditableActiveElement(docWithButton)).toBe(false);
    });
  });
});
