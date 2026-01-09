export class AsyncSignal {
	private pendingCount: number;
	private readonly waiters: Array<() => void>;

	public constructor() {
		this.pendingCount = 0;
		this.waiters = [];
	}

	public trigger(): void {
		const waiter = this.waiters.shift();
		if (waiter !== undefined) {
			waiter();
			return;
		}

		this.pendingCount += 1;
	}

	public wait(): Promise<void> {
		if (this.pendingCount > 0) {
			this.pendingCount -= 1;
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			this.waiters.push(resolve);
		});
	}
}
