import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import fastify from 'fastify'
import FastifyCookie from "@fastify/cookie";
import jwt from 'jsonwebtoken';

import { loadAsset, storeAsset } from './assets'
import { makeOrLoadRoom, ls, createFolder, removeFolder, renameFolder } from './rooms'
import { unfurl } from './unfurl'


import dotenv from 'dotenv'

dotenv.config()

// For this example we're just saving data to the local filesystem
const TOKEN_NAME = process.env.TOKEN_NAME

const PORT = 5858

// For this example we use a simple fastify server with the official websocket plugin
// To keep things simple we're skipping normal production concerns like rate limiting and input validation.
const app = fastify()
app.register(websocketPlugin)
app.register(cors, { origin: '*' })


app.register(FastifyCookie, {
	secret: "my-secret", // Можно указать секрет для подписи
	parseOptions: {}, // Дополнительные опции
	bodyLimit: 100 * 1024 * 1024, // 100 MB.
});



app.addHook("preHandler", async (request, reply) => {
	if (request.method === "GET" || request.method === "POST") {
		const token = request.cookies[TOKEN_NAME]; // Получаем токен из cookie
		if (!token) {
			return reply.status(401).send({ error: "Unauthorized" });
		}

		try {
			// Разворачиваем токен, проверяем его и извлекаем payload
			const decoded = jwt.decode(token) as { username?: string }; // Типизация для извлечения username

			if (decoded) {
				request.userData = decoded.username;
			}
			else {
				return reply.status(401).send({ error: "Unauthorized" });
			}
		} catch (error) {
			console.error('Ошибка при декодировании JWT:', error);
			return reply.status(401).send({ error: "Unauthorized" });
			//return null; // Если ошибка при декодировании, возвращаем null
		}
  
	}
});
  

interface User {
	cn: string;
	projects: string[];
}


const usersMap: Map<string, User> = new Map();


app.register(async (app) => {
	// This is the main entrypoint for the multiplayer sync
	app.get('/ws/connect/*', { websocket: true }, async (socket, req) => {
		// The roomId comes from the URL pathname
		const roomId = (req.params as any)['*'] as string;
		console.log(`Room ID: ${roomId}`);
		// The sessionId is passed from the client as a query param,
		// you need to extract it and pass it to the room.
		const sessionId = (req.query as any)?.['sessionId'] as string
		const roomPath = `${roomId}/board.json`;

		// Here we make or get an existing instance of TLSocketRoom for the given roomId
		const room = await makeOrLoadRoom(roomPath)

		// and finally connect the socket to the room
		room.handleSocketConnect({ sessionId, socket })
	})

	// To enable blob storage for assets, we add a simple endpoint supporting PUT and GET requests
	// But first we need to allow all content types with no parsing, so we can handle raw data
	app.addContentTypeParser('*', (_, __, done) => done(null))
	app.put('/ws/uploads/*', {}, async (req, res) => {
		const path = (req.params as any)['*'] as string;
		await storeAsset(path, req.raw)
		res.send({ ok: true })
	})
	app.get('/ws/uploads/*', async (req, res) => {
		const path = (req.params as any)['*'] as string;
		const data = await loadAsset(path)
		res.send(data)
	})

	// To enable unfurling of bookmarks, we add a simple endpoint that takes a URL query param
	app.get('/ws/unfurl', async (req, res) => {
		const url = (req.query as any).url as string
		res.send(await unfurl(url))
	})

	app.get('/ws/get_user_info', async (req, res) => {
		const data = {username: req.userData};
		res.send(data)
	})

	// List dir.
	app.get('/ws/ls', async (req, res) => {
		let url = (req.query as any).url as string

		if (url === undefined) {
			url = '';
		}

		const dirs = await ls(url);
		res.send(dirs)
	})

	// Create Folder.
	app.get('/ws/mkdir', async (req, res) => {
		const url = (req.query as any).url as string

		const status = await createFolder(url);
		res.send({message: 'success'})
	})

	// Remove Folder.
	app.get('/ws/rmdir', async (req, res) => {
		const url = (req.query as any).url as string

		const status = await removeFolder(url);
		res.send({message: 'success'})
	})

	// Rename Folder.
	app.get('/ws/rename', async (req, res) => {
		const oldUrl = (req.query as any).oldUrl as string
		const newUrl = (req.query as any).newUrl as string

		const status = await renameFolder(oldUrl, newUrl);
		res.send({message: 'success'})
	})
})

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}

	console.log(`Server started on port ${PORT}`)
})
