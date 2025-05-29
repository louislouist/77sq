import { Bot, Context } from "grammy";
import dotenv from "dotenv";

dotenv.config();

export class TelegramBotManager {
	private static token = process.env.TELEGRAM_BOT_TOKEN;
	private static channelId = process.env.TELEGRAM_CHANNEL_ID;

	private static bot: Bot<Context>;
	private static isStarted = false;

	public static isConfigured(): boolean {
		return !!this.token;
	}

	public static init() {
		if (!this.isConfigured()) {
			throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables.");
		}

		this.bot = new Bot(this.token!);

		this.bot.command("start", (ctx) => ctx.reply("👋 Bot is active."));

		this.bot.on("message:text", async (ctx) => {
			await ctx.reply(`You said: ${ctx.message.text}`);
		});

		this.bot.on("channel_post:text", async (ctx) => {
			const text = ctx.channelPost.text?.toLowerCase().trim();

			if (text?.includes("recent flights")) {
				const flights = this.getRecentFlights();
				const reply = flights.map((f, i) => `✈️ Flight ${i + 1}: ${f}`).join("\n");

				await this.sendMessage(this.channelId!, reply);
			}
		});
	}

	public static start() {
		if (!this.bot) throw new Error("Bot not initialized.");
		this.bot.start();
		this.isStarted = true;
		console.log("🚀 Telegram bot started");
	}

	public static async shutdown() {
		if (this.bot && this.isStarted) {
			await this.bot.stop();
			this.isStarted = false;
			console.log("🛑 Telegram bot stopped gracefully");
		}
	}

	public static async sendMessage(chatId: string | number, message: string) {
		if (!this.bot) throw new Error("Bot is not initialized.");
		try {
			await this.bot.api.sendMessage(chatId, message);
		} catch (error) {
			console.error(`❌ Failed to send message to ${chatId}`, error);
		}
	}

	public static async sendToDefaultChannel(message: string) {
		if (!this.channelId) {
			console.warn("⚠️ TELEGRAM_CHANNEL_ID not set.");
			return;
		}
		await this.sendMessage(this.channelId, message);
	}


	private static getRecentFlights(): string[] {
		return ["JFK → LAX, 9:00 AM", "LAX → SFO, 11:00 AM", "SFO → SEA, 1:30 PM"];
	}
}
