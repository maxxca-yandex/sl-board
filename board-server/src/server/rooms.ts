import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import { mkdir, readFile, writeFile, readdir, stat, rm, rename, access, constants } from 'fs/promises'
import { join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

// For this example we're just saving data to the local filesystem
const DIR = `${process.env.BOARD_STORAGE_ROOT}/rooms`

async function splitByLastSlash(input: string): Promise<[string, string]> {
    const lastSlashIndex = input.lastIndexOf('/');
    // Always must at least one slash. server.node.ts corresponds for this.
    return [input.slice(0, lastSlashIndex), input.slice(lastSlashIndex + 1)];
}


async function folderExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}


export async function ls(url: string): Promise<string[]> {
	const absPath = `${DIR}/${url}`
	console.log(`Listing: ${absPath}`);

	if (!await folderExists(absPath)) {
		console.log(`Folder not exist: ${absPath}`);
		return []
	}

	const entries = await readdir(absPath)
	const dirs: string[] = []

	for (const entry of entries) {
		const fullPath = join(absPath, entry)
		const _stat = await stat(fullPath)
		if (_stat.isDirectory()) {
			// dirs.push(`${url}/${entry}`)
			dirs.push(entry)
		}
	}

  return dirs
}


export async function renameFolder(oldUrl: string, newUrl: string): Promise<boolean> {
	const oldAbsPath = `${DIR}/${oldUrl}`
	const newAbsPath = `${DIR}/${newUrl}`

	console.log(`Rename ${oldAbsPath} -> ${newAbsPath}`);
	await rename(oldAbsPath, newAbsPath);

    return true;
}


export async function createFolder(url: string): Promise<boolean> {
	const absPath = `${DIR}/${url}`

	await mkdir(absPath, { recursive: true });
	return true;
}


export async function removeFolder(url: string): Promise<boolean> {
	const absPath = `${DIR}/${url}`

	await rm(absPath, { recursive: true, force: true })
	return true;
}


async function readSnapshotIfExists(roomId: string) {
	try {
			const absPath = join(DIR, roomId)
			console.log(`Read Board File: ${absPath}`)
			const data = await readFile(absPath)
			return JSON.parse(data.toString()) ?? undefined
	} catch (e) {
			// console.log(`Unable to read Room with ID ${roomId}: ${e}`)
			return undefined
	}
}


async function makeUrlsRelative(snapshot: RoomSnapshot): Promise<RoomSnapshot> {
	const updatedDocuments = snapshot.documents.map((doc) => {
		const state = doc.state
		// Image, Video Assets.
		if (
			state?.typeName === 'asset' &&
			(state?.type === 'image' || state?.type === 'video') &&
			state?.props?.src?.startsWith('http')
		) {
			const url = new URL(state.props.src)
			return {
				...doc,
				state: {
					...state,
					props: {
						...state.props,
						src: `/ws/uploads/${url.pathname.split('/').pop()}`
					}
				}
			}
		}
		return doc
	})

	return { ...snapshot, documents: updatedDocuments }
}


async function saveSnapshot(roomId: string, snapshot: RoomSnapshot) {
    const dirList = await splitByLastSlash(roomId);
    // console.log(dirList);
    const absPath = `${DIR}/${dirList[0]}`
	console.log(`Create Folder: ${absPath}`)

    await mkdir(absPath, { recursive: true })
	// await writeFile(join(DIR, roomId), JSON.stringify(snapshot))

	const absBoardPath = join(absPath, dirList[1])
	console.log(`Save Snapshot: ${absBoardPath}`)
	await writeFile(absBoardPath, JSON.stringify(await makeUrlsRelative(snapshot)))
}

// We'll keep an in-memory map of rooms and their data
interface RoomState {
	room: TLSocketRoom<any, void>
	id: string
	needsPersist: boolean
}
const rooms = new Map<string, RoomState>()

// Very simple mutex using promise chaining, to avoid race conditions
// when loading rooms. In production you probably want one mutex per room
// to avoid unnecessary blocking!
const roomMutexes = new Map<string, Promise<void>>();

export async function makeOrLoadRoom(roomId: string) {
    // Получаем или создаем мьютекс для конкретной комнаты
    let roomMutex = roomMutexes.get(roomId);
    if (!roomMutex) {
        roomMutex = Promise.resolve();
        roomMutexes.set(roomId, roomMutex);
    }

    // Обновляем мьютекс для этой комнаты
    roomMutex = roomMutex
        .then(async () => {
            if (rooms.has(roomId)) {
                const roomState = rooms.get(roomId)!;
                if (!roomState.room.isClosed()) {
                    return; // Комната уже существует и активна
                }
            }

            console.log('loading room', roomId);
            const initialSnapshot = await readSnapshotIfExists(roomId);

            const roomState: RoomState = {
                needsPersist: false,
                id: roomId,
                room: new TLSocketRoom({
                    initialSnapshot,
                    onSessionRemoved(room, args) {
                        console.log('client disconnected', args.sessionId, roomId);
                        if (args.numSessionsRemaining === 0) {
                            console.log('closing room', roomId);
                            room.close();
                        }
                    },
                    onDataChange() {
                        roomState.needsPersist = true;
                    },
                }),
            };
            rooms.set(roomId, roomState);
        })
        .catch((error) => {
            console.error('Error in room mutex:', error);
            throw error; // Пробрасываем ошибку дальше
        });

    // Обновляем мьютекс в Map
    roomMutexes.set(roomId, roomMutex);

    // Ждем завершения операции для этой комнаты
    await roomMutex;
    return rooms.get(roomId)!.room;
}


setInterval(() => {
	for (const roomState of rooms.values()) {
		if (roomState.needsPersist) {
			// persist room
			roomState.needsPersist = false
			console.log('saving snapshot', roomState.id)
			saveSnapshot(roomState.id, roomState.room.getCurrentSnapshot())
		}
		if (roomState.room.isClosed()) {
			console.log('deleting room', roomState.id)
			rooms.delete(roomState.id)
		}
	}
}, 5000)


// Remove rooms from mutex list.
setInterval(() => {
    for (const [roomId, roomState] of rooms.entries()) {
        if (roomState.room.isClosed()) {
            console.log('deleting room', roomId);
            rooms.delete(roomId);
            roomMutexes.delete(roomId); // Удаляем мьютекс для закрытой комнаты
        }
    }
}, 5000);
