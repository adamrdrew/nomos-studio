export type ToolHotkeyPlatform = 'mac' | 'win-linux';

export type ToolHotkeyDescriptor = Readonly<{
  digit: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0';
  requiresShift: boolean;
}>;

export function getToolHotkeyDescriptorForIndex(toolIndex: number): ToolHotkeyDescriptor | null {
  if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= 20) {
    return null;
  }

  const bank = Math.floor(toolIndex / 10);
  const digitIndex = toolIndex % 10;

  const digit =
    digitIndex === 9
      ? '0'
      : (String(digitIndex + 1) as '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9');

  return {
    digit,
    requiresShift: bank === 1
  };
}

export function formatToolHotkeyLabel(descriptor: ToolHotkeyDescriptor, platform: ToolHotkeyPlatform): string {
  if (platform === 'mac') {
    return descriptor.requiresShift ? `⇧⌘${descriptor.digit}` : `⌘${descriptor.digit}`;
  }
  return descriptor.requiresShift ? `Ctrl+Shift+${descriptor.digit}` : `Ctrl+${descriptor.digit}`;
}

export function parseToolIndexFromKeyboardEvent(
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey'>,
  platform: ToolHotkeyPlatform,
  options?: Readonly<{ allowNumpad?: boolean }>
): number | null {
  const allowNumpad = options?.allowNumpad ?? true;

  const hasPrimaryModifier = platform === 'mac' ? event.metaKey : event.ctrlKey;
  if (!hasPrimaryModifier) {
    return null;
  }

  const digit = parseDigitFromKeyboardCode(event.code, allowNumpad);
  if (digit === null) {
    return null;
  }

  const digitIndex = digit === '0' ? 9 : Number(digit) - 1;
  const bankBase = event.shiftKey ? 10 : 0;

  return bankBase + digitIndex;
}

export function isElementEditable(element: Element | null): boolean {
  if (element === null) {
    return false;
  }

  // Avoid relying on DOM globals (HTMLElement) so this helper remains unit-testable in Jest's Node environment.
  if ('isContentEditable' in element && (element as { isContentEditable?: boolean }).isContentEditable === true) {
    return true;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function isEditableActiveElement(doc: Pick<Document, 'activeElement'>): boolean {
  return isElementEditable(doc.activeElement);
}

function parseDigitFromKeyboardCode(
  code: string,
  allowNumpad: boolean
): ToolHotkeyDescriptor['digit'] | null {
  const digit = code.startsWith('Digit') ? code.slice('Digit'.length) : allowNumpad && code.startsWith('Numpad') ? code.slice('Numpad'.length) : null;
  if (digit === null) {
    return null;
  }

  switch (digit) {
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      return digit;
    default:
      return null;
  }
}
