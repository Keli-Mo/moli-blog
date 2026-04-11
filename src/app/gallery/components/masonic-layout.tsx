'use client'

import { useMemo, useState, useEffect, ComponentType } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Masonry } from 'masonic'
import { Picture } from '../page'
import { X } from 'lucide-react'

// 为 Masonry 组件添加类型定义，兼容 React 19
const MasonryComponent = Masonry as unknown as ComponentType<{
	items: any[]
	columnCount: number
	columnGutter: number
	overscanBy: number
	className: string
	render: (props: { data: any }) => JSX.Element
}>

interface MasonicLayoutProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: (picture: Picture) => void
}

/**
 * ImageLightbox - 图片放大灯箱组件
 * 点击图片后全屏展示，支持点击遮罩或按 Esc 关闭
 */
function ImageLightbox({ url, description, onClose }: { url: string; description?: string; onClose: () => void }) {
	useEffect(() => {
		// 按 Esc 键关闭灯箱
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			onClick={onClose}
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
			{/* 关闭按钮 */}
			<button
				onClick={onClose}
				className='absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors'>
				<X size={24} />
			</button>

			{/* 图片主体，阻止点击冒泡避免误关 */}
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.9, opacity: 0 }}
				onClick={e => e.stopPropagation()}
				className='relative max-w-[90vw] max-h-[90vh]'>
				<img src={url} alt={description || '图片'} className='max-w-full max-h-[90vh] object-contain rounded-lg' />
				{/* 描述文字 */}
				{description && (
					<div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-lg'>
						<p className='text-white text-sm'>{description}</p>
					</div>
				)}
			</motion.div>
		</motion.div>
	)
}

/**
 * ImageCard - 单个图片卡片组件
 * 用于瀑布流中显示单张图片及其描述
 * 在编辑模式下提供删除功能；非编辑模式下点击可放大
 */
function ImageCard({
	url,
	pictureId,
	imageIndex,
	description,
	isEditMode,
	onDelete,
	onExpand
}: {
	url: string
	pictureId: string
	imageIndex: number | 'single'
	description?: string
	isEditMode?: boolean
	onDelete: () => void
	onExpand: () => void
}) {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			className='group relative overflow-hidden rounded-lg bg-gray-100'>
			{/* 非编辑模式下点击放大 */}
			<img
				src={url}
				alt={description || '图片'}
				className={`w-full h-auto object-cover ${!isEditMode ? 'cursor-zoom-in' : ''}`}
				onClick={!isEditMode ? onExpand : undefined}
			/>

			{/* 图片描述叠加层 - hover 时才显示 */}
			{description && (
				<div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
					<p className='text-white text-sm line-clamp-2'>{description}</p>
				</div>
			)}

			{/* 编辑模式下的删除按钮 */}
			{isEditMode && (
				<motion.button
					initial={{ opacity: 0 }}
					whileHover={{ opacity: 1 }}
					whileTap={{ scale: 0.9 }}
					onClick={onDelete}
					className='absolute top-2 right-2 p-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100'>
					<X size={16} />
				</motion.button>
			)}
		</motion.div>
	)
}

/**
 * MasonicLayout - 瀑布流布局组件
 * 使用 masonic 库实现响应式网格布局
 * 支持 3 列布局、间距 16px、响应式调整
 */
export function MasonicLayout({ pictures, isEditMode, onDeleteSingle, onDeleteGroup }: MasonicLayoutProps) {
	const [isClient, setIsClient] = useState(false)
	// 当前放大展示的图片信息
	const [lightbox, setLightbox] = useState<{ url: string; description?: string } | null>(null)

	useEffect(() => {
		setIsClient(true)
	}, [])

	/**
	 * 将图片组数据结构扁平化为单个图片列表
	 * 便于 masonic 库进行网格布局计算
	 */
	const items = useMemo(() => {
		return pictures.flatMap((picture, groupIndex) => {
			const urls = picture.images && picture.images.length > 0 ? picture.images : picture.image ? [picture.image] : []
			return urls.map((url, imageIndex) => ({
				key: `${picture.id}::${imageIndex === urls.length - 1 && urls.length === 1 ? 'single' : imageIndex}`,
				url,
				pictureId: picture.id,
				imageIndex: imageIndex === urls.length - 1 && urls.length === 1 ? ('single' as const) : imageIndex,
				description: picture.description,
				groupIndex
			}))
		})
	}, [pictures])

	// 直接使用 items.length 作为 key，确保每次长度变化都重新挂载 Masonry
	// 避免 masonic 内部缓存与新的 items 长度不一致导致报错
	const masonryKey = items.length

	// 服务端渲染时返回 null，避免 Hydration 不匹配
	if (!isClient) {
		return null
	}

	if (items.length === 0) {
		return null
	}

	return (
		<div className='w-full py-10 px-4'>
			{/* key 随 items.length 变化，避免 masonic 缓存错误 */}
			<MasonryComponent
				key={masonryKey}
				items={items}
				columnCount={3}
				columnGutter={16}
				overscanBy={5}
				className=''
				render={({ data: item }) => (
					<ImageCard
						key={item.key}
						url={item.url}
						pictureId={item.pictureId}
						imageIndex={item.imageIndex}
						description={item.description}
						isEditMode={isEditMode}
						onDelete={() => onDeleteSingle?.(item.pictureId, item.imageIndex)}
						onExpand={() => setLightbox({ url: item.url, description: item.description })}
					/>
				)}
			/>

			{/* 图片放大灯箱 */}
			<AnimatePresence>
				{lightbox && (
					<ImageLightbox
						url={lightbox.url}
						description={lightbox.description}
						onClose={() => setLightbox(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}
