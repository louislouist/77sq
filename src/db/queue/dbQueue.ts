import { AdvancedJobQueue } from './dbAdvancedQueue';

// start singleton to handle db queue across functions.
export const dbQueue = new AdvancedJobQueue(
	5, // Max concurrent reads
	1  // Max concurrent writes
);
