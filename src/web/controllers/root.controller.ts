import { Request, Response } from "express";

export const rootPage = async (_req: Request, res: Response) => {
	res.send('Hello from 77sq!!!');
}
