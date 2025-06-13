import { useState } from 'react'
import { Splitter, SplitterPanel } from 'primereact/splitter'

import TreeViewWidget from './TreeView'
import { EditorContext } from '../pages/EditorContext'
import Editor from '../pages/Editor'


export default function SplitterWidget() {
	const [editor, setEditor] = useState(null)

	return (
		<EditorContext.Provider value={{ editor}}>
			<Splitter style={{ height: '100vh' }}>
				<SplitterPanel className="flex flex-column" size={10} minSize={10}>
					<TreeViewWidget />
				</SplitterPanel>
				<SplitterPanel className="flex justify-content-center align-items-center" size={90}>
					<Editor onEditorMount={setEditor} />
				</SplitterPanel>
			</Splitter>
		</EditorContext.Provider>
	)
}
