// Date handling functions.
//
export function formatDateEpoch(time: number, local?: string): string {
	// Convert to milliseconds if input is in seconds
	const date = new Date(time);
	const iso639_1 = local ? local : 'en-US';

	// Define formatting options
	const options: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour12: false,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Local timezone
	};

	// Create formatter for US locale
	const formatter = new Intl.DateTimeFormat(iso639_1, options);
	const parts = formatter.formatToParts(date);

	// Extract parts
	const get = (type: string) => parts.find(p => p.type === type)?.value || '';

	const formatted = `${get('hour')}:${get('minute')}:${get('second')} ${get('weekday')} ${get('month')}-${get('day')}-${get('year')}`;

	return formatted;
}
