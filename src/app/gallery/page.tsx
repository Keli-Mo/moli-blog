'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import initialList from './list.json'
import externalSourceConfig from './external-source.json'
import { MasonicLayout } from './components/masonic-layout'
import UploadDialog from './components/upload-dialog'
import ExternalSourceDialog from './components/external-source-config'
import { pushPictures } from './services/push-pictures'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import type { ImageItem } from '../projects/components/image-upload-dialog'
import { useRouter } from 'next/navigation'
import type { ExternalSourceConfig } from './components/external-source-config'
import { loadExternalConfig, saveExternalConfig } from './lib/storage'

// 动态获取外部索引，避免缓存问题
async function fetchExternalIndex(): Promise<{ updatedAt: string; urls: string[] }> {
	try {
		const response = await fetch('/gallery/external-index.json?t=' + Date.now())
		if (!response.ok) return { updatedAt: '', urls: [] }
		return await response.json()
	} catch {
		return { updatedAt: '', urls: [] }
	}
}

/**
 * Gallery Page - 图片瀑布流展示页面
 * 支持本地图片（list.json）+ 外部图源（R2等）混合显示
 * 外部图源使用本地索引文件（external-index.json），无需每次检测
 */

export interface Picture {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
}

/**
 * 检测图片 URL 是否存在
 * 使用 fetch HEAD 请求检测，通过存在性检查 API 避免跨域问题
 */
async function checkImageExists(url: string): Promise<boolean> {
	try {
		// 解析文件路径，构建存在性检查 API URL
		// 原始 URL: https://cloudflare-imgbed-9ut.pages.dev/file/1.webp
		// 检查 URL: https://cloudflare-imgbed-9ut.pages.dev/api/exists/1.webp
		const urlObj = new URL(url)
		let pathname = urlObj.pathname

		// 将 /file/ 开头的路径替换为 /api/exists/
		if (pathname.startsWith('/file/')) {
			pathname = '/api/exists' + pathname.slice('/file'.length)
		}

		const checkUrl = `${urlObj.origin}${pathname}`

		// 使用 HEAD 请求检查文件是否存在
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 5000)

		const response = await fetch(checkUrl, {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-cache',
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		// 200 表示文件存在，404 表示不存在
		return response.ok
	} catch (error) {
		// 网络错误或其他异常，视为不存在
		return false
	}
}

/**
 * 从配置生成 URL 列表
 */
function generateUrlsFromConfig(config: ExternalSourceConfig): string[] {
	if (!config.enabled || !config.urlTemplate.includes('{n}')) {
		return []
	}
	const urls: string[] = []
	for (let i = config.start; i <= config.end; i++) {
		urls.push(config.urlTemplate.replace('{n}', String(i)))
	}
	return urls
}

/**
 * 将 URL 列表转换为 Picture 对象
 */
function urlsToPictures(urls: string[], description?: string): Picture[] {
	const now = new Date().toISOString()
	return urls.map((url, index) => ({
		id: `external-${index}`,
		uploadedAt: now,
		description: description || undefined,
		images: [url]
	}))
}

/**
 * 合并默认配置和本地存储配置
 */
function getInitialConfig(): ExternalSourceConfig {
	const defaultConfig = { ...(externalSourceConfig as ExternalSourceConfig), enabled: true }
	const saved = loadExternalConfig()
	return saved || defaultConfig
}

export default function GalleryPage() {
	const [localPictures, setLocalPictures] = useState<Picture[]>(initialList as Picture[])
	const [originalPictures, setOriginalPictures] = useState<Picture[]>(initialList as Picture[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
	const [isExternalSourceOpen, setIsExternalSourceOpen] = useState(false)
	const [externalConfig, setExternalConfig] = useState<ExternalSourceConfig>(getInitialConfig())
	const [externalPictures, setExternalPictures] = useState<Picture[]>([])
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [checkedCount, setCheckedCount] = useState(0)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const keyInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	/**
	 * 从本地索引加载外部图源图片
	 * 动态获取 external-index.json 以避免静态导入缓存
	 */
	const loadFromIndex = useCallback(async () => {
		if (!externalConfig.enabled) {
			setExternalPictures([])
			return
		}

		// 动态获取索引文件，避免静态导入缓存
		const indexData = await fetchExternalIndex()
		if (indexData.urls.length > 0) {
			setExternalPictures(urlsToPictures(indexData.urls, externalConfig.description))
		} else {
			// 索引为空时，生成 URL 但不检测（等待用户手动刷新）
			const urls = generateUrlsFromConfig(externalConfig)
			setExternalPictures(urlsToPictures(urls, externalConfig.description))
		}
	}, [externalConfig])

	/**
	 * 手动刷新 - 检测所有图片并更新索引
	 */
	const handleRefreshIndex = useCallback(async () => {
		if (!externalConfig.enabled || !externalConfig.urlTemplate.includes('{n}')) {
			toast.error('请先启用外部图源并配置 URL 模板')
			return
		}

		setIsRefreshing(true)
		setCheckedCount(0)

		const urls = generateUrlsFromConfig(externalConfig)
		const validUrls: string[] = []
		const batchSize = 5

		// 批量检测
		for (let i = 0; i < urls.length; i += batchSize) {
			const batch = urls.slice(i, i + batchSize)
			const results = await Promise.all(
				batch.map(async url => {
					const exists = await checkImageExists(url)
					return { url, exists }
				})
			)

			results.forEach(({ url, exists }) => {
				if (exists) validUrls.push(url)
			})

			setCheckedCount(Math.min(i + batchSize, urls.length))
		}

		// 更新显示
		setExternalPictures(urlsToPictures(validUrls, externalConfig.description))
		setIsRefreshing(false)

		// 保存到索引文件（如果已登录）
		if (isAuth) {
			try {
				const { pushExternalIndex } = await import('./services/push-external-index')
				await pushExternalIndex(validUrls)
				toast.success(`已更新索引: ${validUrls.length}/${urls.length} 张图片`)
			} catch (error) {
				toast.error('保存索引失败，但当前页面已更新')
			}
		} else {
			toast.success(`检测完成: ${validUrls.length}/${urls.length} 张图片（未登录，索引未保存）`)
		}
	}, [externalConfig, isAuth])

	/**
	 * 初始加载和配置变更时重新加载
	 */
	useEffect(() => {
		loadFromIndex()
	}, [loadFromIndex])

	/**
	 * 页面重新获得焦点时刷新索引（检测文件更新）
	 */
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				loadFromIndex()
			}
		}
		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [loadFromIndex])

	/**
	 * 合并本地图片和外部图源图片
	 */
	const allPictures = [...externalPictures, ...localPictures]

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
	 * 处理外部图源配置更新
	 */
	const handleExternalSourceSave = async (config: ExternalSourceConfig) => {
		setExternalConfig(config)
		saveExternalConfig(config)
		toast.success('外部图源配置已更新')

		if (isAuth) {
			try {
				const { pushExternalSourceConfig } = await import('./services/push-external-source')
				await pushExternalSourceConfig(config)
			} catch {
				// 静默失败
			}
		}
	}

	/**
	 * 删除单个图片
	 */
	const handleDeleteSingleImage = (pictureId: string, imageIndex: number | 'single') => {
		if (pictureId.startsWith('external-')) {
			toast.info('外部图源的图片需在配置中调整范围')
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

		setImageItems(prev => {
			const next = new Map(prev)
			if (imageIndex === 'single') {
				for (const key of next.keys()) {
					if (key.startsWith(`${pictureId}::`)) {
						next.delete(key)
					}
				}
			} else {
				next.delete(`${pictureId}::${imageIndex}`)

				const keysToUpdate: Array<{ oldKey: string; newKey: string }> = []
				for (const key of next.keys()) {
					if (key.startsWith(`${pictureId}::`)) {
						const [, indexStr] = key.split('::')
						const oldIndex = Number(indexStr)
						if (!isNaN(oldIndex) && oldIndex > imageIndex) {
							const newIndex = oldIndex - 1
							keysToUpdate.push({
								oldKey: key,
								newKey: `${pictureId}::${newIndex}`
							})
						}
					}
				}

				for (const { oldKey, newKey } of keysToUpdate) {
					const value = next.get(oldKey)
					if (value) {
						next.set(newKey, value)
						next.delete(oldKey)
					}
				}
			}
			return next
		})
	}

	/**
	 * 删除整个图片组
	 */
	const handleDeleteGroup = (picture: Picture) => {
		if (picture.id.startsWith('external-')) {
			toast.info('外部图源的图片需在配置中调整范围')
			return
		}

		if (!confirm('确定要删除这一组图片吗？')) return

		setLocalPictures(prev => prev.filter(p => p.id !== picture.id))
		setImageItems(prev => {
			const next = new Map(prev)
			for (const key of next.keys()) {
				if (key.startsWith(`${picture.id}::`)) {
					next.delete(key)
				}
			}
			return next
		})
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
	 * 保存修改到 GitHub
	 */
	const handleSave = async () => {
		setIsSaving(true)

		try {
			await pushPictures({
				pictures: localPictures,
				imageItems
			})

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
		setExternalConfig(getInitialConfig())
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
			/>

			{/* 空状态提示 */}
			{allPictures.length === 0 && (
				<div className='text-secondary flex min-h-screen items-center justify-center text-center text-sm'>
					还没有上传图片，点击右上角「编辑」后即可开始上传。
				</div>
			)}

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
								externalConfig.enabled
									? 'bg-green-50 text-green-700'
									: 'bg-purple-50 text-purple-700'
							}`}>
							{externalConfig.enabled ? '外部图源 ✓' : '外部图源'}
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

			{/* 外部图源配置对话框 */}
			{isExternalSourceOpen && (
				<ExternalSourceDialog
					onClose={() => setIsExternalSourceOpen(false)}
					onSave={handleExternalSourceSave}
					onRefresh={handleRefreshIndex}
					isRefreshing={isRefreshing}
					checkedCount={checkedCount}
					externalCount={externalPictures.length}
				/>
			)}
		</>
	)
}
