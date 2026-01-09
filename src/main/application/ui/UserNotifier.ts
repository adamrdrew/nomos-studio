export type UserNotifier = Readonly<{
  showError: (title: string, message: string, detail?: string) => Promise<void>;
  showInfo: (title: string, message: string, detail?: string) => Promise<void>;
}>;
