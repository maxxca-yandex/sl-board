import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSync } from '@tldraw/sync'
import {
	AssetRecordType,
	getHashForString,
	TLAssetStore,
	TLBookmarkAsset,
	Tldraw,
	uniqueId,
	TLUserPreferences,
    useTldrawUser
} from 'tldraw'
import 'tldraw/tldraw.css'


// Tldraw connect method does not recognize relative url,
// So we have tp construct full URL.
const WORKER_URL = `${window.location.origin}/ws`
console.log(`WORKER_URL: ${WORKER_URL}`);

const SSO_URL = import.meta.env.VITE_SSO_URL;
console.log(SSO_URL);

export default function Editor({ onEditorMount }) {
	const [searchParams] = useSearchParams();
	const [userPreferences, setUserPreferences] = useState<TLUserPreferences>({
            id: 'user-' + Math.random().toString(),
            name: 'User Name',
            // color: 'palevioletred',
            colorScheme: 'dark',
        })
	
	useEffect(() => {
		async function fetchData() {
			try {
				const response = await fetch(`${WORKER_URL}/get_user_info`);
				if (response.status === 401) {
					const redirectUrl = encodeURIComponent(window.location.href);
					window.location.href = `https://tools.sphericallife.ru/login?redirect=${redirectUrl}`;
			}
	
			if (!response.ok) throw new Error("Ошибка загрузки данных пользователя");
	
			const data = await response.json();

			// console.log('Authorized');
			// console.log(data);
			setUserPreferences({
				id:  data.username + Math.random().toString(),
				name: data.username,
			});
	
			} catch (error) {
				console.error("Ошибка:", error);
			} 
		}
	
		fetchData();
		}, []); // 🔹 useEffect вызывается один раз при загрузке
		
	
    let boardPath = searchParams.get("board");

	const themeLink = document.getElementById('theme-link') as HTMLLinkElement;

	if (themeLink.href.includes('light')) {
		userPreferences.colorScheme = 'light';
	}
	else {
		userPreferences.colorScheme = 'dark'
	}

	if (!boardPath) {
		boardPath = "home";
	}
	
	console.log(`Board Path: ${boardPath}`);

	const store = useSync({
		uri: `${WORKER_URL}/connect/${boardPath}`,
		assets: multiplayerAssets,
		userInfo: userPreferences,
	})
	const currentUser = useTldrawUser({ userPreferences, setUserPreferences })

	return (
		<Tldraw
			store={store}
			user={currentUser}
			onMount={(editor) => {
				// @ts-expect-error
				window.editor = editor
				editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
			
				if (onEditorMount) {
					onEditorMount(editor)
				}
			}}
		/>
	)
}

const multiplayerAssets: TLAssetStore = {
	async upload(_asset, file) {
			const id = uniqueId()
			console.log(file);

			let file_name = file.name;
			//if (file.name == 'tldrawFile') {
			//    file_name = 'screen_shot.jpg';
			//}

			const date = new Date();
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы в JS начинаются с 0
			const day = String(date.getDate()).padStart(2, '0');

			const formattedDate = `${year}/${month}/${day}`;
			// console.log(formattedDate);

			const objectName = `${formattedDate}/${id}-${file_name}`
			const url = `${WORKER_URL}/uploads/${encodeURIComponent(objectName)}`

			const response = await fetch(url, {
					method: 'PUT',
					body: file,
			})

			if (!response.ok) {
					throw new Error(`Failed to upload asset: ${response.statusText}`)
			}

		return { src: url }
	},
	resolve(asset) {
		return asset.props.src
	},
}

async function unfurlBookmarkUrl({ url }: { url: string }): Promise<TLBookmarkAsset> {
	const asset: TLBookmarkAsset = {
		id: AssetRecordType.createId(getHashForString(url)),
		typeName: 'asset',
		type: 'bookmark',
		meta: {},
		props: {
			src: url,
			description: '',
			image: '',
			favicon: '',
			title: '',
		},
	}
	try {
		const response = await fetch(`${WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`)
		const data = await response.json()
		asset.props = {
			...asset.props,
			description: data?.description ?? '',
			image: data?.image ?? '',
			favicon: data?.favicon ?? '',
			title: data?.title ?? '',
		}
	} catch (e) {
		console.error(e)
	}
	return asset
}
