'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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

/**
 * Gallery Page - 图片瀑布流展示页面
 * 支持本地图片（list.json）+ 外部图源（R2等）混合显示
 * 外部图源自动检测可用图片，只显示能加载的图片
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
 * 使用 fetch HEAD 请求检查真实 HTTP 状态码
 * 404页面会返回 HTML，但 status 是 404，可以正确识别
 */
async function checkImageExists(url: string): Promise<boolean> {
	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 5000)

		const response = await fetch(url, {
			method: 'HEAD',
			mode: 'cors',
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		// 只接受 200-299 状态码，404/403/500 等都认为不存在
		return response.ok
	} catch {
		// fetch 失败（可能是 CORS 或网络问题），降级使用 Image 对象检测
		return new Promise(resolve => {
			const img = new Image()
			// 设置跨域属性
			img.crossOrigin = 'anonymous'

			img.onload = () => resolve(true)
			img.onerror = () => resolve(false)

			// 添加时间戳避免缓存
			img.src = url + (url.includes('?') ? '&' : '?') + '_check=' + Date.now()

			setTimeout(() => resolve(false), 5000)
		})
	}
}

/**
 * 批量检测图片是否存在
 * 并发检测，每批 5 个
 */
async function batchCheckImages(urls: string[], onProgress?: (checked: number) => void): Promise<string[]> {
	const batchSize = 5
	const validUrls: string[] = []

	for (let i = 0; i < urls.length; i += batchSize) {
		const batch = urls.slice(i, i + batchSize)
		const results = await Promise.all(
			batch.map(async url => ({
				url,
				exists: await checkImageExists(url)
			}))
		)

		results.forEach(({ url, exists }) => {
			if (exists) validUrls.push(url)
		})

		onProgress?.(Math.min(i + batchSize, urls.length))
	}

	return validUrls
}

export default function GalleryPage() {
	const [localPictures, setLocalPictures] = useState<Picture[]>(initialList as Picture[])
	const [originalPictures, setOriginalPictures] = useState<Picture[]>(initialList as Picture[])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
	const [isExternalSourceOpen, setIsExternalSourceOpen] = useState(false)
	const [externalConfig, setExternalConfig] = useState<ExternalSourceConfig>(externalSourceConfig as ExternalSourceConfig)
	const [externalPictures, setExternalPictures] = useState<Picture[]>([])
	const [isCheckingExternal, setIsCheckingExternal] = useState(false)
	const [checkedCount, setCheckedCount] = useState(0)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const keyInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	/**
	 * 检测并更新外部图源图片
	 */
	const refreshExternalPictures = useCallback(async () => {
		if (!externalConfig.enabled || !externalConfig.urlTemplate.includes('{n}')) {
			setExternalPictures([])
			return
		}

		setIsCheckingExternal(true)
		setCheckedCount(0)

		// 生成 URL 列表
		const urls: string[] = []
		for (let i = externalConfig.start; i <= externalConfig.end; i++) {
			urls.push(externalConfig.urlTemplate.replace('{n}', String(i)))
		}

		// 批量检测
		const validUrls = await batchCheckImages(urls, setCheckedCount)

		// 生成 Picture 对象
		const now = new Date().toISOString()
		const pictures: Picture[] = validUrls.map((url, index) => ({
			id: `external-${index}`,
			uploadedAt: now,
			description: externalConfig.description || undefined,
			images: [url]
		}))

		setExternalPictures(pictures)
		setIsCheckingExternal(false)

		if (validUrls.length < urls.length) {
			toast.success(`检测到 ${validUrls.length}/${urls.length} 张可用图片`)
		}
	}, [externalConfig])

	/**
	 * 配置改变时重新检测
	 */
	useEffect(() => {
		refreshExternalPictures()
	}, [refreshExternalPictures])

	/**
	 * 合并本地图片和外部图源图片
	 */
	const allPictures = [...externalPictures, ...localPictures]

	/**
	 * 处理上传提交 - 创建新的图片组条目并加入到本地列表
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
		toast.success('外部图源配置已更新，正在检测可用图片...')

		if (isAuth) {
			try {
				const { pushExternalSourceConfig } = await import('./services/push-external-source')
				await pushExternalSourceConfig(config)
				toast.success('配置已保存到仓库')
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
		setExternalConfig(externalSourceConfig as ExternalSourceConfig)
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

	// 计算检测进度
	const totalToCheck = externalConfig.enabled
		? externalConfig.end - externalConfig.start + 1
		: 0
	const checkProgress = totalToCheck > 0 ? Math.round((checkedCount / totalToCheck) * 100) : 0

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

			{/* 外部图源检测提示 */}
			{externalConfig.enabled && (
				<div className='absolute top-4 left-6 text-xs text-gray-500'>
					{isCheckingExternal ? (
						<span className='flex items-center gap-1'>
							<Loader2 className='h-3 w-3 animate-spin' />
							检测外部图片 {checkedCount}/{totalToCheck} ({checkProgress}%)
						</span>
					) : (
						<>
							外部图源: {externalPictures.length} 张
							{localPictures.length > 0 && ` | 本地: ${localPictures.length} 张`}
						</>
					)}
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
			{isExternalSourceOpen && <ExternalSourceDialog onClose={() => setIsExternalSourceOpen(false)} onSave={handleExternalSourceSave} />}
		</>
	)
}
