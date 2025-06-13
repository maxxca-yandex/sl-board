import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Tree, TreeExpandedKeysType } from 'primereact/tree';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { TreeNode } from 'primereact/treenode';
import { ContextMenu } from 'primereact/contextmenu';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from "primereact/inputtext";
import { FloatLabel } from "primereact/floatlabel";
import { Toolbar } from 'primereact/toolbar';
import { ToggleButton, ToggleButtonChangeEvent } from 'primereact/togglebutton';

import { PrimeIcons } from 'primereact/api';

import 'primeicons/primeicons.css';

import { useSharedEditor } from '../pages/EditorContext'


const HOST = '/ws'


function createNode(folderName: string, folderKey: string): TreeNode {
	const ts = Date.now().toString();

	return {
		id: folderKey,
		key: folderKey,
		label: folderName,
		icon: PrimeIcons.FOLDER,
		leaf: false,
		children: [],
	}}


function CreateFolderDialog({
	visible,
	onHide,
	value,
	onChange,
	onCreate,
	editor,
}: {
	visible: boolean
	onHide: () => void
	value: string
	onChange: (value: string) => void
	onCreate: () => void
	editor: any
}) {
	useEffect(() => {
		if (visible) {
			editor?.blur?.()
		} else {
			editor?.focus?.()
		}
	}, [visible])

	const footerContent = (
		<div>
			<Button label="Create" icon={PrimeIcons.CHECK} onClick={onCreate} autoFocus />
		</div>
	)

	return (
		<Dialog
			header="Enter New Folder Name"
			visible={visible}
			position={'center'}
			style={{ width: '20vw' }}
			onHide={onHide}
			footer={footerContent}
			draggable
			resizable={false}
		>
			<p className="m-0">
				<FloatLabel style={{ width: '100%' }}>
					<InputText
						style={{ width: '100%' }}
						id="foldername"
						value={value}
						onChange={(e) => onChange(e.target.value)}
					/>
					<label htmlFor="foldername">Folder Name</label>
				</FloatLabel>
			</p>
		</Dialog>
	)
}


function RenameFolderDialog({
	visible,
	onHide,
	value,
	onChange,
	onRename,
	editor,
}: {
	visible: boolean
	onHide: () => void
	value: string
	onChange: (value: string) => void
	onRename: () => void
	editor: any
}) {
	useEffect(() => {
		if (visible) {
			editor?.blur?.()
		} else {
			editor?.focus?.()
		}
	}, [visible])

	const footerContent = (
		<div>
			<Button label="Rename" icon={PrimeIcons.CHECK} onClick={onRename} autoFocus />
		</div>
	)

	return (
		<Dialog
			header="Enter New Folder Name"
			visible={visible}
			position={'center'}
			style={{ width: '20vw' }}
			onHide={onHide}
			footer={footerContent}
			draggable
			resizable={false}
		>
			<p className="m-0">
				<FloatLabel style={{ width: '100%' }}>
					<InputText
						style={{ width: '100%' }}
						id="foldername"
						value={value}
						onChange={(e) => onChange(e.target.value)}
					/>
					<label htmlFor="foldername">Folder Name</label>
				</FloatLabel>
			</p>
		</Dialog>
	)
}


export default function TreeViewWidget() {
	const [searchParams] = useSearchParams();
	const [theme, setTheme] = useState(() => {
		const flag = localStorage.getItem('theme');
		return flag !== 'dark';
	  });
    const [nodes, setNodes] = useState<TreeNode[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<TreeExpandedKeysType>({});
	const [selectedNode, setSelectedNode] = useState<string | null>(null); // For selection with Left Click and navigation.
    const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null); // For Context Menu, Right Click
	const [loading, setLoading] = useState<boolean>(false);	
	const [visibleCreateDialog, setVisibleCreateDialog] = useState(false);
	const [visibleRenameDialog, setVisibleRenameDialog] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');

	const [deleteVisible, setDeleteVisible] = useState(false);

    const toast = useRef<Toast>(null);
    const cm = useRef<ContextMenu>(null);

	const navigate = useNavigate();
    const location = useLocation();
	const getSelectedNodeByKey = (nodeKey: string, tree: TreeNode[] = nodes): TreeNode | undefined => {
		for (const node of tree) {
			if (node.key === nodeKey) {
				return node;
			}
			if (node.children) {
				const found = getSelectedNodeByKey(nodeKey, node.children);
				if (found) {
					return found;
					}
				}
			}
			return undefined;
		};

	//

	const initProjects = async () => {
		let projectNodes = []

		try {
			setLoading(true);
			const response = await fetch(`${HOST}/ls`)
			const projects = await response.json()
			console.log(projects);

			for (const project of projects) {
				const projectNode = createNode(project, project);
				projectNodes.push(projectNode);
			}

			setNodes(projectNodes);

			setLoading(false);
		} catch (e) {
			console.error(e);
			setLoading(false);
			toast.current?.show({ severity: 'error', summary: 'Listing Failed', detail: e });
		}

		await expandTreeOnStart(projectNodes);
    }

	const expandTreeOnStart = async (projectNodes: TreeNode[]) => {
		let boardPath = searchParams.get("board");

		if (!boardPath) {
			boardPath = "home";
		}

		let start: string[] = [];
		const parts = boardPath.split('/'); 

		for (const part of parts) {
			start.push(part);
			const currentPath = start.join('/');
			console.log(currentPath);
			
			const myTreeNode = getSelectedNodeByKey(currentPath, projectNodes);
			if (myTreeNode === undefined) {
				console.log(`Undefined: ${currentPath}`);
				continue
			}

			const syntheticEvent = {
				node: myTreeNode,
			};
			
			await loadOnExpand(syntheticEvent);

			setExpandedKeys((prev) => ({
			...prev,
			[currentPath]: true,
			}));

		  }
		setSelectedNode(boardPath);
	}

	const handleNewFolder = async () => {
		const absPath = `${selectedNodeKey}/${newFolderName}`;

		console.log(`Create Folder ${absPath}`);
		await mkdir(absPath);

		const newNode = createNode(newFolderName, absPath);
		const parentNode = getSelectedNodeByKey(selectedNodeKey, nodes);

		parentNode.children.push(newNode);

		setVisibleCreateDialog(false);
		setNewFolderName('');
	}

	const deleteNodeByKey = (nodeKey: string, tree: TreeNode[]): TreeNode[] => {
		return tree
			.map(node => {
				if (node.children) {
					// Рекурсивно фильтруем потомков
					const updatedChildren = deleteNodeByKey(nodeKey, node.children);
					return { ...node, children: updatedChildren };
				}
				return node;
			})
			.filter(node => node.key !== nodeKey); // Удаляем сам узел, если он совпадает
	};

	// Рекурсивная функция для обновления дерева
	const addChildNode = (tree: TreeNode[], newNode: TreeNode, givenNodeKey?: string): TreeNode[] => {
		return tree.map(node => {
			if (node.key === selectedNodeKey || node.key === givenNodeKey) {
				const children = node.children ? [...node.children, newNode] : [newNode];
				return { ...node, children, leaf: false }; // leaf: false обязательно
			} else if (node.children) {
				return { ...node, children: addChildNode(node.children, newNode) };
			}
			return node;
		});
	};

	const loadOnExpand = async (event) => {
		//if (event.node === undefined) {
		//	return
		//} 

		if (event.node.children && event.node.children.length > 0) {
			return
		}

		event.node.icon = PrimeIcons.FOLDER_OPEN;

		try {
			setLoading(true);
			console.log(`Listing DIR for ${event.node.key}`);
			const response = await fetch(`${HOST}/ls?url=${event.node.key}`)
			const data = await response.json()

			for (const item of data) {
				const node_key = `${event.node.key}/${item}`

				const existedNode = getSelectedNodeByKey(node_key, nodes);

				if (!existedNode){
					const newNode = createNode(item, node_key);
					event.node.children.push(newNode);
				}
			}

			setLoading(false);
		} catch (e) {
				console.error(e);
				setLoading(false);
				toast.current?.show({ severity: 'error', summary: 'Listing Failed', detail: event.node.key });
			}
    	}
	
	const mkdir = async (relativePath: string) => {
		try {
			setLoading(true);
			console.log(`Create Folder: ${relativePath}`);
			const response = await fetch(`${HOST}/mkdir?url=${relativePath}`)

			if (!response.ok) {
          		const errorData = await response.json();
          		throw new Error(errorData.detail || 'Error creating folder');
        	}
			setLoading(false);
			toast.current?.show({ severity: 'success', summary: 'Folder Created', detail: relativePath });
		} catch (e) {
			console.error(e);
			setLoading(false);
			toast.current?.show({ severity: 'error', summary: 'Failed', detail: e });
		}
	}

	const deleteFolder = async (nodeKey: string | null) => {
		if (!nodeKey) {
			return
		}

		setNodes(prevNodes => deleteNodeByKey(nodeKey, prevNodes));

		try {
			setLoading(true);
			console.log(`Delete Folder: ${nodeKey}`);
			const response = await fetch(`${HOST}/rmdir?url=${nodeKey}`)

			if (!response.ok) {
          		const errorData = await response.json();
          		throw new Error(errorData.detail || 'Error creating folder');
        	}
			navigate(`/?board=home`);
			toast.current?.show({ severity: 'success', summary: 'Folder Deleted', detail: nodeKey });
			setLoading(false);
			setSelectedNodeKey(null);
		} catch (e) {
			console.error(e);
			setLoading(false);
			toast.current?.show({ severity: 'error', summary: 'Failed', detail: e });
		}
	}

	const renameFolder = async () => {
		const givenNode = getSelectedNodeByKey(selectedNodeKey);
		const parentPath = selectedNodeKey.slice(0, selectedNodeKey.lastIndexOf("/"));

		const newUrl = `${parentPath}/${newFolderName}`;

		console.log(`Rename ${selectedNodeKey} -> ${newUrl}`);
		givenNode.key = newUrl;
		givenNode.id = newFolderName;
		givenNode.label = newFolderName;

		setVisibleRenameDialog(false);

		const queryParams = new URLSearchParams(location.search);
    	const currentPath = queryParams.get("board");

		try {
			const response = await fetch(`${HOST}/rename?oldUrl=${selectedNodeKey}&newUrl=${newUrl}`)

			if (!response.ok) {
          		const errorData = await response.json();
          		throw new Error(errorData.detail || 'Error rename folder');
        	}
			if (currentPath === selectedNodeKey) {
				console.log(`Navigate to ${newUrl}`);
				navigate(`/?board=${newUrl}`);
		}
			toast.current?.show({ severity: 'success', summary: 'Folder rename', detail: newUrl });
		} catch (e) {
			console.error(e);
			toast.current?.show({ severity: 'error', summary: 'Failed', detail: e });
		}

		setSelectedNodeKey(null);
		setVisibleRenameDialog(false);
	}

	const onSelectionChange = (nodeKey: string) => {
		if (!nodeKey) {
			return;
		}

		setSelectedNode(nodeKey);
		navigate(`/?board=${nodeKey}`);
	}

    const menu = [
        {
            label: 'View Debug Info',
            icon: PrimeIcons.SEARCH,
            command: () => {
                toast.current?.show({ severity: 'success', summary: 'Node Key', detail: selectedNodeKey });
            }
        },
		{
			label: 'Create Folder',
			icon: PrimeIcons.FOLDER,
			command: () => {
				setNewFolderName('');
				setVisibleCreateDialog(true);
			}
		},
		{
			label: 'Rename',
			icon: PrimeIcons.USER_EDIT,
			command: () => {
				const count = selectedNodeKey.split('/').length - 1;
				if (count === 0) {
					toast.current?.show({ severity: 'error', summary: 'Failed', detail: 'You cannot rename root folders.' });
					return
				}
				console.log(`Rename: ${selectedNodeKey}`);
				setNewFolderName('');
				setVisibleRenameDialog(true);
			}
		},
		{
			label: 'Delete',
			icon: PrimeIcons.DELETE_LEFT,
			command: () => {
				setDeleteVisible(true);
			}
		}
    ];

    useEffect(() => {
        // setNodes(initData);
		initProjects();
    }, []);

	const goHome = () => {
		setSelectedNode(null);
		setExpandedKeys({});
		navigate(`/?board=home`);
	}

	const startContent = (
        <>
            <Button
				icon={PrimeIcons.HOME}
				rounded
				text
				raised
				severity="info"
				size='small'
				onClick={goHome} />
        </>
    );

	const setThemeValue = (themeFlag: boolean) => {
		const themeLink = document.getElementById('theme-link') as HTMLLinkElement;

		if (themeFlag) {
			themeLink.href = '/themes/lara-light-cyan/theme.css';
			localStorage.setItem('theme', 'light');
		}
		else {
			themeLink.href = '/themes/lara-dark-blue/theme.css';
			localStorage.setItem('theme', 'dark');
		}
		setTheme(themeFlag);
	}

	const ThemeSwitcher = (
		<>
			<ToggleButton
				onLabel=""
				offLabel=""
				onIcon={PrimeIcons.SUN}
				offIcon={PrimeIcons.MOON}
				checked={theme}
				onChange={(e:  ToggleButtonChangeEvent) => setThemeValue(e.value)} />
		</>
	);

    return (
        <>
            <Toast ref={toast} />

            <ContextMenu model={menu} ref={cm} />
			<ConfirmDialog
				group="declarative"
				visible={deleteVisible}
				onHide={() => setDeleteVisible(false)}
				message={`Delete ${selectedNodeKey} ?`} 
                header="Confirmation"
				icon={PrimeIcons.EXCLAMATION_TRIANGLE}
				accept={() => deleteFolder(selectedNodeKey)}
				reject={() => setDeleteVisible(false)} />
			<CreateFolderDialog
				visible={visibleCreateDialog}
				onHide={() => setVisibleCreateDialog(false)}
				value={newFolderName}
				onChange={setNewFolderName}
				onCreate={handleNewFolder}
				editor={useSharedEditor()}
			/>
			<RenameFolderDialog
				visible={visibleRenameDialog}
				onHide={() => setVisibleRenameDialog(false)}
				value={newFolderName}
				onChange={setNewFolderName}
				onRename={renameFolder}
				editor={useSharedEditor()}
			/>
			<Toolbar start={startContent} end={ThemeSwitcher}/>
            <Tree
				value={nodes}
				onExpand={loadOnExpand}
				loading={loading}
				expandedKeys={expandedKeys}
				selectionMode="single"
				selectionKeys={selectedNode}
				onSelectionChange={(e) => onSelectionChange(e.value)}
				onToggle={(e) => setExpandedKeys(e.value)}
				contextMenuSelectionKey={selectedNodeKey}
				onContextMenuSelectionChange={(e) => setSelectedNodeKey(e.value)} 
                onContextMenu={(e) => cm.current?.show(e.originalEvent)}
				style={{ width: '100%', height: '100%' }} />
        </>
    )
}
        