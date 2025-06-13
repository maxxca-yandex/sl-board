import { mkdir, readFile, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { Readable } from 'stream'

import dotenv from 'dotenv'

dotenv.config()

// For this example we're just saving data to the local filesystem
const DIR = `${process.env.BOARD_STORAGE_ROOT}/media`

async function splitByLastSlash(input: string): Promise<[string, string]> {
    const lastSlashIndex = input.lastIndexOf('/');
    return [input.slice(0, lastSlashIndex), input.slice(lastSlashIndex + 1)];
}


export async function storeAsset(id: string, stream: Readable) {
    const dirList = await splitByLastSlash(id);
    // console.log(dirList);
    const absDirPath = `${DIR}/${dirList[0]}`
    console.log(`Create Folder for Media: ${absDirPath}`);
    await mkdir(absDirPath, { recursive: true })

    const filePath = join(absDirPath, dirList[1])
    console.log(`Write File: ${filePath}`);
    await writeFile(filePath, stream)
}


export async function loadAsset(id: string) {
    const filePath = join(DIR, id)
    console.log(`Read Media: ${filePath}`)

	return await readFile(filePath)
}
