export type UnsavedChangesPromptChoice = 'save' | 'dont-save' | 'cancel';

export type UserPrompter = Readonly<{
  confirmUnsavedChanges: (options: Readonly<{ filePath: string }>) => Promise<UnsavedChangesPromptChoice>;
}>;
