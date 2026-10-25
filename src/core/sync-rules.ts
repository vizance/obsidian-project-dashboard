export function isProjectNotePath(path: string, folder: string): boolean {
	if (!path.endsWith('.md')) return false;
	const prefix = `${folder}/`;
	if (!path.startsWith(prefix)) return false;
	const rest = path.slice(prefix.length);
	return rest.length > 0 && !rest.includes('/');
}

export function isRelevantChange(path: string, oldPath: string | undefined, folder: string): boolean {
	if (isProjectNotePath(path, folder)) return true;
	return oldPath !== undefined && isProjectNotePath(oldPath, folder);
}

interface Timers {
	set(fn: () => void, ms: number): number;
	clear(id: number): void;
}

export function createDebouncer(delayMs: number, timers: Timers, fn: () => void): { trigger: () => void; cancel: () => void } {
	let timerId: number | null = null;
	return {
		trigger() {
			if (timerId !== null) timers.clear(timerId);
			timerId = timers.set(() => {
				timerId = null;
				fn();
			}, delayMs);
		},
		cancel() {
			if (timerId !== null) {
				timers.clear(timerId);
				timerId = null;
			}
		},
	};
}
