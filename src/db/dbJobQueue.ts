type Job = () => Promise<void>;

class JobQueue {
	private queue: Job[] = [];
	private isProcessing = false;

	add(job: Job) {
		this.queue.push(job);
		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	private async processQueue() {
		this.isProcessing = true;
		while (this.queue.length > 0) {
			const job = this.queue.shift();
			if (!job) continue;

			try {
				await job();
			} catch (err) {
				console.error("JobQueue encountered an error:", err);
			}
		}
		this.isProcessing = false;
	}
}

export const dbJobQueue = new JobQueue();
