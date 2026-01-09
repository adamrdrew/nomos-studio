import { AsyncSignal } from './asyncSignal';

describe('AsyncSignal', () => {
	it('resolves wait immediately when there is a pending trigger', async () => {
		const signal = new AsyncSignal();

		signal.trigger();

		await expect(signal.wait()).resolves.toBeUndefined();
	});

	it('wait blocks until trigger is called', async () => {
		const signal = new AsyncSignal();

		let resolved = false;
		const waitPromise = signal.wait().then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(false);

		signal.trigger();

		await waitPromise;
		expect(resolved).toBe(true);
	});

	it('one trigger resolves only one waiter', async () => {
		const signal = new AsyncSignal();

		let firstResolved = false;
		let secondResolved = false;

		const first = signal.wait().then(() => {
			firstResolved = true;
		});
		const second = signal.wait().then(() => {
			secondResolved = true;
		});

		signal.trigger();

		await first;
		expect(firstResolved).toBe(true);

		await Promise.resolve();
		expect(secondResolved).toBe(false);

		signal.trigger();
		await second;
		expect(secondResolved).toBe(true);
	});

	it('multiple triggers accumulate and resolve multiple future waits', async () => {
		const signal = new AsyncSignal();

		signal.trigger();
		signal.trigger();

		await expect(signal.wait()).resolves.toBeUndefined();
		await expect(signal.wait()).resolves.toBeUndefined();
	});
});
