/*
	.get() method is great for simple SELECTs.
	.run() method is great for INSERT, UPDATE, and DELETE.
	.all() to return all rows from a SELECT query.
	logic with BEGIN TRANSACTION, still use add(...)
*/

type Job = {
	fn: () => Promise<void>;
	priority: number;
	type: 'read' | 'write';
};

export class AdvancedJobQueue {
	private queue: Job[] = [];
	private runningReads = 0;
	private runningWrites = 0;

	constructor(
		private maxReadConcurrency = 5,
		private maxWriteConcurrency = 1
	) { }

	add(jobFn: () => Promise<void>, priority = 1, type: 'read' | 'write' = 'write') {
		this.queue.push({ fn: jobFn, priority, type });
		this.queue.sort((a, b) => b.priority - a.priority); // highest priority first
		this.processQueue();
	}

	private async processQueue() {
		if (this.queue.length === 0) return;

		for (let i = 0; i < this.queue.length; i++) {
			const job = this.queue[i];

			if (job.type === 'write' && this.runningWrites < this.maxWriteConcurrency && this.runningReads === 0) {
				this.queue.splice(i, 1);
				this.runningWrites++;
				this.runJob(job, () => this.runningWrites--);
				break;
			}

			if (job.type === 'read' && this.runningReads < this.maxReadConcurrency && this.runningWrites === 0) {
				this.queue.splice(i, 1);
				this.runningReads++;
				this.runJob(job, () => this.runningReads--);
				i--; // allow other reads to run
			}
		}
	}

	private async runJob(job: Job, onComplete: () => void) {
		try {
			await job.fn();
		} catch (err) {
			console.error("AdvancedJobQueue error:", err);
		} finally {
			onComplete();
			this.processQueue();
		}
	}

	// Wraps db.get(...) safely in the queue
	get<T = any>(db: any, sql: string, params: any[] = [], priority = 1): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			this.add(async () => {
				try {
					const result = await db.get(sql, params);
					resolve(result);
				} catch (err) {
					reject(err);
				}
			}, priority, 'read');
		});
	}

	// Wraps db.run(...) safely in the queue
	run(db: any, sql: string, params: any[] = [], priority = 1): Promise<any> {
		return new Promise((resolve, reject) => {
			this.add(async () => {
				try {
					const result = await db.run(sql, params);
					resolve(result);
				} catch (err) {
					reject(err);
				}
			}, priority, 'write');
		});
	}

	// Return all rows from a SELECT query
	all<T = any[]>(db: any, sql: string, params: any[] = [], priority = 1): Promise<T> {
		return new Promise((resolve, reject) => {
			this.add(async () => {
				try {
					const result = await db.all(sql, params);
					resolve(result);
				} catch (err) {
					reject(err);
				}
			}, priority, 'read');
		});
	}
}
