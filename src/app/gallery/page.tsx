'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import initialList from './list.json'
import { MasonicLayout } from './components/masonic-layout'
import { TagSidebar } from './components/tag-sidebar'
import { TagSidebarToggle } from './components/tag-sidebar-toggle'
import UploadDialog from './components/upload-dialog'
import ExternalSourceDialog from './components/external-source-config'
import { pushPictures } from './services/push-pictures'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import type { ImageItem } from '../projects/components/image-upload-dialog'
import { useRouter } from 'next/navigation'

/**
 * Gallery Page - 图片瀑布流展示页面
 * 支持本地图片（list.json）+ 外部图源（R2等）混合显示
 *
 * 工作流程：
 * 1. 进入页面时，只读取 external-index.json 中已有的索引，不检测远端
 * 2. 点击更新按钮时，输入范围 n-m，只检测该范围内的图片
 * 3. 检测完成后，更新 external-index.json（添加存在的，移除不存在的）
 */

export interface Picture {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
	tags?: string[]
}

interface ExternalIndexItem {
	url: string
	tags?: string[]
}

interface ExternalIndex {
	updatedAt: string
	urls?: string[]
	items?: ExternalIndexItem[]
}

/**
 * 将外部图源 items 转换为 Picture 对象
 */
function itemsToPictures(items: ExternalIndexItem[]): Picture[] {
	return items.map((item, index) => ({
		id: `external-${index}`,
		uploadedAt: new Date().toISOString(),
		images: [item.url],
		tags: item.tags || []
	}))
}

/**
 * 检测单个图片是否存在
 * 使用 fetch HEAD 请求检测
 */
async function checkImageExists(url: string): Promise<boolean> {
	try {
		const urlObj = new URL(url)
		let pathname = urlObj.pathname

		// 将 /file/ 开头的路径替换为 /api/exists/
		if (pathname.startsWith('/file/')) {
			pathname = '/api/exists' + pathname.slice('/file'.length)
		}

		// 添加时间戳绕过缓存
		const checkUrl = `${urlObj.origin}${pathname}?_t=${Date.now()}`

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 5000)

		const response = await fetch(checkUrl, {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-cache',
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		const exists = response.ok
		console.log(`[checkImageExists] ${url} -> status:${response.status}, exists:${exists}`)
		return exists
	} catch (err) {
		console.log(`[checkImageExists] ${url} -> error:`, err)
		return false
	}
}

export default function GalleryPage() {
	const [localPictures, setLocalPictures] = useState<Picture[]>(initialList as Picture[])
	const [originalPictures, setOriginalPictures] = useState<Picture[]>(initialList as Picture[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
	const [isExternalSourceOpen, setIsExternalSourceOpen] = useState(false)

	// 外部图源状态
	const [externalPictures, setExternalPictures] = useState<Picture[]>([])
	const [externalUrls, setExternalUrls] = useState<string[]>([])

	// 检测状态
	const [isChecking, setIsChecking] = useState(false)
	const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 })

	// 侧边栏状态
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [sidebarMode, setSidebarMode] = useState<'filter' | 'edit'>('filter')
	const [currentEditingPictureId, setCurrentEditingPictureId] = useState<string | null>(null)

	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const keyInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	/**
	 * 加载外部图源索引（只读本地索引，不检测远端）
	 */
	const loadExternalIndex = useCallback(async () => {
		try {
			// 添加时间戳和缓存控制头，防止浏览器缓存
			const response = await fetch(`/gallery/external-index.json?_t=${Date.now()}`, {
				cache: 'no-store',
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Pragma': 'no-cache'
				}
			})
			if (!response.ok) {
				console.log('[Gallery] 索引文件不存在或加载失败，清空外部图片')
				setExternalPictures([])
				setExternalUrls([])
				return
			}
		const data: ExternalIndex = await response.json()
			// 兼容旧格式（urls 数组）和新格式（items 数组）
			let items: ExternalIndexItem[]
			if (data.items && data.items.length > 0) {
				items = data.items.filter(item => item.url && item.url.trim() !== '')
			} else {
				items = (data.urls || []).filter(url => url && url.trim() !== '').map(url => ({ url }))
			}
			const urls = items.map(item => item.url)
			console.log(`[Gallery] 加载索引成功: ${items.length} 张图片`, urls)
			setExternalUrls(urls)
			setExternalPictures(itemsToPictures(items))
		} catch (err) {
			console.error('[Gallery] 加载索引失败:', err)
			setExternalPictures([])
			setExternalUrls([])
		}
	}, [])

	/**
	 * 初始加载 - 只读取索引，不检测
	 */
	useEffect(() => {
		loadExternalIndex()
	}, [loadExternalIndex])

	/**
	 * 检测指定范围的图片并更新索引
	 * 只检测 n-m 范围，存在则添加/保留，不存在则移除
	 */
	const handleCheckRange = useCallback(async (start: number, end: number, urlTemplate: string) => {
		if (isChecking) return

		setIsChecking(true)
		setCheckProgress({ current: 0, total: end - start + 1 })

		// 构建检测范围内的 URL 列表
		const urlsToCheck: string[] = []
		for (let i = start; i <= end; i++) {
			urlsToCheck.push(urlTemplate.replace('{n}', String(i)))
		}

		// 批量检测（每批5个，避免并发过多）
		const batchSize = 5
		const validUrlsInRange: string[] = []

		for (let i = 0; i < urlsToCheck.length; i += batchSize) {
			const batch = urlsToCheck.slice(i, i + batchSize)
			const results = await Promise.all(
				batch.map(async url => {
					console.log(`[Gallery] 检测中: ${url}`)
					const exists = await checkImageExists(url)
					console.log(`[Gallery] 检测结果: ${url} -> ${exists ? '✓ 存在' : '✗ 不存在'}`)
					return { url, exists }
				})
			)

			results.forEach(({ url, exists }) => {
				if (exists) {
					validUrlsInRange.push(url)
				}
			})

			setCheckProgress({
				current: Math.min(i + batchSize, urlsToCheck.length),
				total: urlsToCheck.length
			})
		}

		// 合并索引：保留范围外的原有 URL + 范围内检测有效的 URL
		const urlsOutsideRange = externalUrls.filter(url => {
			// 从 URL 中提取编号
			const match = url.match(/(\d+)\.webp$/)
			if (!match) return true // 无法解析的保留
			const num = parseInt(match[1], 10)
			return num < start || num > end // 保留范围外的
		})

		// 新的 URL 列表 = 范围外的原有 + 范围内检测有效的
		const newUrls = [...urlsOutsideRange, ...validUrlsInRange]

		console.log(`[Gallery] 检测完成: 范围${start}-${end}, 有效${validUrlsInRange.length}张`, validUrlsInRange)
		console.log(`[Gallery] 范围外保留: ${urlsOutsideRange.length}张`, urlsOutsideRange)
		console.log(`[Gallery] 新的索引: ${newUrls.length}张`, newUrls)

		// 按编号排序
		newUrls.sort((a, b) => {
			const matchA = a.match(/(\d+)\.webp$/)
			const matchB = b.match(/(\d+)\.webp$/)
			if (!matchA || !matchB) return 0
			return parseInt(matchA[1], 10) - parseInt(matchB[1], 10)
		})

		// 更新本地状态（不刷新页面）
		// 合并时保留已有标签
		const existingTagsMap = new Map<string, string[]>()
		externalPictures.forEach(p => {
			const url = p.images?.[0]
			if (url && p.tags && p.tags.length > 0) existingTagsMap.set(url, p.tags)
		})
		const newItems: ExternalIndexItem[] = newUrls.map(url => ({
			url,
			tags: existingTagsMap.get(url) || []
		}))
		setExternalUrls(newUrls)
		setExternalPictures(itemsToPictures(newItems))
		setIsChecking(false)

		// 如果已登录，保存到 GitHub
		console.log(`[Gallery] 保存索引: isAuth=${isAuth}`)
		if (isAuth) {
			try {
				console.log(`[Gallery] 开始推送索引到 GitHub:`, newUrls)
				const { pushExternalIndex } = await import('./services/push-external-index')
				await pushExternalIndex(newUrls)
				console.log(`[Gallery] 索引推送成功`)
				toast.success(
					`检测完成: 范围 ${start}-${end} 中找到 ${validUrlsInRange.length} 张图片，总计 ${newUrls.length} 张`
				)
			} catch (error) {
				console.error(`[Gallery] 索引推送失败:`, error)
				toast.error('保存索引失败，但页面已更新')
			}
		} else {
			console.log(`[Gallery] 未登录，不保存索引`)
			toast.success(
				`检测完成: 范围 ${start}-${end} 中找到 ${validUrlsInRange.length} 张图片（未登录，索引未保存）`
			)
		}
	}, [externalUrls, isAuth, isChecking])

	/**
	 * 更新图片标签
	 */
	const handleTagsChange = useCallback((pictureId: string, tags: string[]) => {
		if (pictureId.startsWith('external-')) {
			setExternalPictures(prev =>
				prev.map(p => (p.id === pictureId ? { ...p, tags } : p))
			)
		} else {
			setLocalPictures(prev =>
				prev.map(p => (p.id === pictureId ? { ...p, tags } : p))
			)
		}
		// 标记为已修改
		setIsEditMode(true)
	}, [])

	/**
	 * 合并本地图片和外部图源图片
	 */
	const allPictures = [...externalPictures, ...localPictures]

	// 调试信息
	console.log('[Gallery] 外部图片:', externalPictures.length, '本地图片:', localPictures.length)

	/**
	 * 处理外部图片加载失败
	 * 从当前显示中移除加载失败的图片（但不修改索引文件）
	 */
	const handleImageError = useCallback((url: string) => {
		console.error(`[Gallery] 图片加载失败，从显示中移除: ${url}`)
		// 只处理外部图源的图片
		if (!url.includes('cloudflare-imgbed')) return

		setExternalPictures(prev => {
			const filtered = prev.filter(p => !p.images?.includes(url))
			console.log(`[Gallery] 移除前: ${prev.length}, 移除后: ${filtered.length}`)
			return filtered
		})
		setExternalUrls(prev => prev.filter(u => u !== url))
	}, [])

	/**
	 * 处理上传提交
	 */
	const handleUploadSubmit = ({ images, description }: { images: ImageItem[]; description: string }) => {
		const now = new Date().toISOString()

		if (images.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}

		const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
		const desc = description.trim() || undefined

		const imageUrls = images.map(imageItem => (imageItem.type === 'url' ? imageItem.url : imageItem.previewUrl))

		const newPicture: Picture = {
			id,
			uploadedAt: now,
			description: desc,
			images: imageUrls
		}

		const newMap = new Map(imageItems)

		images.forEach((imageItem, index) => {
			if (imageItem.type === 'file') {
				newMap.set(`${id}::${index}`, imageItem)
			}
		})

		setLocalPictures(prev => [...prev, newPicture])
		setImageItems(newMap)
		setIsUploadDialogOpen(false)
	}

	/**
	 * 删除单个图片
	 */
	const handleDeleteSingleImage = (pictureId: string, imageIndex: number | 'single') => {
		if (pictureId.startsWith('external-')) {
			toast.info('外部图源的图片需在更新索引时移除')
			return
		}

		setLocalPictures(prev => {
			return prev
				.map(picture => {
					if (picture.id !== pictureId) return picture

					if (imageIndex === 'single') {
						return null
					}

					if (picture.images && picture.images.length > 0) {
						const newImages = picture.images.filter((_, idx) => idx !== imageIndex)
						if (newImages.length === 0) {
							return null
						}
						return {
							...picture,
							images: newImages
						}
					}

					return picture
				})
				.filter((p): p is Picture => p !== null)
		})
	}

	/**
	 * 删除整个图片组
	 */
	const handleDeleteGroup = (picture: Picture) => {
		if (picture.id.startsWith('external-')) {
			toast.info('外部图源的图片需在更新索引时移除')
			return
		}

		if (!confirm('确定要删除这一组图片吗？')) return

		setLocalPictures(prev => prev.filter(p => p.id !== picture.id))
	}

	const handleChoosePrivateKey = async (file: File) => {
		try {
			const text = await file.text()
			setPrivateKey(text)
			await handleSave()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleSaveClick = () => {
		if (!isAuth) {
			keyInputRef.current?.click()
		} else {
			handleSave()
		}
	}

	/**
	 * 保存修改到 GitHub（本地图片 + 外部图源标签）
	 */
	const handleSave = async () => {
		setIsSaving(true)

		try {
			// 保存本地图片
			await pushPictures({
				pictures: localPictures,
				imageItems
			})

			// 同时保存外部图源索引（含标签）
			if (externalPictures.length > 0) {
				const { pushExternalIndex } = await import('./services/push-external-index')
				const externalItems = externalPictures.map(p => ({
					url: p.images?.[0] || '',
					tags: p.tags || []
				})).filter(item => item.url)
				await pushExternalIndex(externalItems)
			}

			setOriginalPictures(localPictures)
			setImageItems(new Map())
			setIsEditMode(false)
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setLocalPictures(originalPictures)
		setImageItems(new Map())
		setIsEditMode(false)
	}

	const buttonText = isAuth ? '保存' : '导入密钥'

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setIsEditMode(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isEditMode])

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await handleChoosePrivateKey(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

		{/* 瀑布流布局容器 */}
			<MasonicLayout
				pictures={allPictures}
				isEditMode={isEditMode}
				onDeleteSingle={handleDeleteSingleImage}
				onDeleteGroup={handleDeleteGroup}
				onImageError={handleImageError}
				onTagsChange={handleTagsChange}
				onLightboxOpen={(pictureId) => {
					setCurrentEditingPictureId(pictureId)
					setSidebarMode('edit')
					setSidebarOpen(true)
				}}
				onLightboxClose={() => {
					setCurrentEditingPictureId(null)
					setSidebarMode('filter')
				}}
			/>

			{/* 空状态提示 */}
			{allPictures.length === 0 && (
				<div className='text-secondary flex min-h-screen items-center justify-center text-center text-sm'>
					还没有上传图片，点击右上角「编辑」后即可开始上传。
				</div>
			)}

			{/* 侧边栏 */}
			<TagSidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				mode={sidebarMode}
				allTags={Array.from(new Set(allPictures.flatMap(p => p.tags || []))).sort()}
				activeTags={[]}
				onTagToggle={() => {}}
				onTagsClear={() => {}}
				currentPictureTags={currentEditingPictureId ? allPictures.find(p => p.id === currentEditingPictureId)?.tags || [] : []}
				onCurrentPictureTagsChange={currentEditingPictureId ? (tags) => handleTagsChange(currentEditingPictureId, tags) : undefined}
			/>

			{/* 侧边栏展开按钮 */}
			<TagSidebarToggle
				onClick={() => setSidebarOpen(!sidebarOpen)}
				mode={sidebarMode}
				tagCount={sidebarMode === 'edit' && currentEditingPictureId ? (allPictures.find(p => p.id === currentEditingPictureId)?.tags?.length || 0) : 0}
			/>

			{/* 操作按钮工具栏 */}
			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => router.push('/image-toolbox')}
							className='rounded-xl border bg-blue-50 px-4 py-2 text-sm text-blue-700'>
							压缩工具
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsExternalSourceOpen(true)}
							className={`rounded-xl border px-4 py-2 text-sm ${
								externalUrls.length > 0
									? 'bg-green-50 text-green-700'
									: 'bg-purple-50 text-purple-700'
							}`}>
							{externalUrls.length > 0 ? `外部图源 (${externalUrls.length})` : '外部图源'}
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsUploadDialogOpen(true)}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							上传
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleSaveClick}
							disabled={isSaving}
							className='brand-btn px-6'>
							{isSaving ? '保存中...' : buttonText}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsEditMode(true)}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			{/* 上传对话框 */}
			{isUploadDialogOpen && <UploadDialog onClose={() => setIsUploadDialogOpen(false)} onSubmit={handleUploadSubmit} />}

			{/* 外部图源更新对话框 */}
			{isExternalSourceOpen && (
				<ExternalSourceDialog
					onClose={() => setIsExternalSourceOpen(false)}
					onCheckRange={handleCheckRange}
					isChecking={isChecking}
					checkProgress={checkProgress}
					currentUrls={externalUrls}
				/>
			)}
		</>
	)
}
