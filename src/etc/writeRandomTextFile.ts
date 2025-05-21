import { writeFile, mkdir } from 'fs/promises';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Writes a string to a randomly named .txt file inside the ./log directory.
 * @param content The text to write to the file.
 * @returns The full path of the written file.
 */
export async function writeRandomTextFile(content: string): Promise<string> {
	const directory = './logs';

	// Create the log directory if it doesn't exist
	if (!existsSync(directory)) {
		await mkdir(directory, { recursive: true });
	}

	// Generate a random 8-character alphanumeric filename
	const randomName = randomBytes(4).toString('hex'); // 8 hex characters
	const fileName = `${randomName}.txt`;
	const filePath = join(directory, fileName);

	// Write the content to the file
	await writeFile(filePath, content, 'utf8');

	return filePath;
}
