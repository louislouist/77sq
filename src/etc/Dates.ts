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
        const get = (type: string) =>
                parts.find((p) => p.type === type)?.value || '';

        const formatted = `${get('hour')}:${get('minute')}:${get('second')} ${get('weekday')} ${get('month')}-${get('day')}-${get('year')}`;

        return formatted;
}

export function getTimestamp(): string {
        const now = new Date();

        // Get hours, minutes, and seconds
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        // Get day of the week (e.g., "Sat")
        const dayOfWeek = now.toLocaleString('en-US', { weekday: 'short' });

        // Get month and day (e.g., "06-28")
        const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month is zero-indexed
        const day = now.getDate().toString().padStart(2, '0');

        // Get the year (e.g., "2025")
        const year = now.getFullYear();

        // Format the string as "HH:MM:SS Day MM-DD-YYYY"
        return `${hours}:${minutes}:${seconds} ${dayOfWeek} ${month}-${day}-${year}`;
}

export function timeLastSeen(time: number): string {
        const last = new Date(time);

        const hours = last.getHours().toString().padStart(2, '0');
        const minutes = last.getMinutes().toString().padStart(2, '0');
        const seconds = last.getSeconds().toString().padStart(2, '0');
        const month = (last.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
        const day = last.getDate().toString().padStart(2, '0');
        const year = last.getFullYear();

        return `${hours}:${minutes}:${seconds}:${month}/${day}/${year}`;
}

export function getCurrentUTCwithUSDateTime(): string {
        const nowUtc = new Date();

        // Get each part in UTC
        const year = nowUtc.getUTCFullYear();
        const month = String(nowUtc.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(nowUtc.getUTCDate()).padStart(2, '0');
        const hours = String(nowUtc.getUTCHours()).padStart(2, '0');
        const minutes = String(nowUtc.getUTCMinutes()).padStart(2, '0');
        const seconds = String(nowUtc.getUTCSeconds()).padStart(2, '0');

        // Return in US ISO-style format: MM-DD-YYYY HH:MM:SS
        return `${month}-${day}-${year} ${hours}:${minutes}:${seconds} UTC`;
}
