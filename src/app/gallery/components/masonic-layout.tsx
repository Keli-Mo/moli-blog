'use client'

import React, { useMemo, useState, useEffect, ComponentType, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Masonry } from 'masonic'
import { Picture } from '../page'
import { X, ChevronLeft, ChevronRight, ZoomIn, Tag } from 'lucide-react'
import { TagEditor } from './tag-editor'

// 为 Masonry 组件添加类型定义，兼容 React 19
const MasonryComponent = Masonry as unknown as ComponentType<{
	items: any[]
	columnCount: number
	columnGutter: number
	overscanBy: number
	className: string
	render: (props: { data: any }) => React.ReactElement
}>

interface MasonicLayoutProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: (picture: Picture) => void
	onImageError?: (url: string) => void
	onTagsChange?: (pictureId: string, tags: string[]) => void
	onLightboxOpen?: (pictureId: string) => void
	onLightboxClose?: () => void
}

/** 扁平化后的图片项 */
interface FlatItem {
	key: string
	url: string
	pictureId: string
	imageIndex: number | 'single'
	description?: string
	tags?: string[]
	groupIndex: number
	/** 同组内所有 URL，用于灯箱左右切换 */
	groupUrls: string[]
	/** 当前图片在组内的位置 */
	posInGroup: number
}

/**
 * ImageLightbox - 艺术感灯箱组件
 * 支持 Esc/点击遮罩关闭、左右切换同组图片
 */
function ImageLightbox({
	url,
	description,
	tags,
	groupUrls,
	posInGroup,
	onClose,
	onNavigate
}: {
	url: string
	description?: string
	tags?: string[]
	groupUrls: string[]
	posInGroup: number
	onClose: () => void
	onNavigate: (newPos: number) => void
}) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
			if (e.key === 'ArrowLeft' && posInGroup > 0) onNavigate(posInGroup - 1)
			if (e.key === 'ArrowRight' && posInGroup < groupUrls.length - 1) onNavigate(posInGroup + 1)
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onClose, onNavigate, posInGroup, groupUrls.length])

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
			onClick={onClose}
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-4'>

			{/* 关闭按钮 */}
			<button
				onClick={onClose}
				className='absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200 cursor-pointer'>
				<X size={18} />
			</button>

			{/* 左箭头 */}
			{posInGroup > 0 && (
				<button
					onClick={e => { e.stopPropagation(); onNavigate(posInGroup - 1) }}
					className='absolute left-5 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200 cursor-pointer'>
					<ChevronLeft size={22} />
				</button>
			)}

			{/* 右箭头 */}
			{posInGroup < groupUrls.length - 1 && (
				<button
					onClick={e => { e.stopPropagation(); onNavigate(posInGroup + 1) }}
					className='absolute right-5 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200 cursor-pointer'>
					<ChevronRight size={22} />
				</button>
			)}

			{/* 图片主体 */}
			<motion.div
				key={url}
				initial={{ scale: 0.88, opacity: 0, y: 16 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				exit={{ scale: 0.92, opacity: 0 }}
				transition={{ type: 'spring', stiffness: 320, damping: 28 }}
				onClick={e => e.stopPropagation()}
				className='relative max-w-[88vw] max-h-[88vh] flex flex-col items-center'>
				<img
					src={url}
					alt={description || '图片'}
					className='max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl'
				/>
				{/* 描述 + 标签 + 计数 */}
				<div className='mt-3 flex flex-col items-center gap-2'>
					{description && (
						<p className='text-white/70 text-sm tracking-wide'>{description}</p>
					)}
					{tags && tags.length > 0 && (
						<div className='flex flex-wrap justify-center gap-1.5'>
							{tags.map(tag => (
								<span key={tag} className='px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 text-xs'>
									{tag}
								</span>
							))}
						</div>
					)}
					{groupUrls.length > 1 && (
						<span className='text-white/40 text-xs tabular-nums'>
							{posInGroup + 1} / {groupUrls.length}
						</span>
					)}
				</div>
			</motion.div>
		</motion.div>
	)
}

/**
 * ImageCard - 艺术感图片卡片
 * hover 时显示渐变遮罩 + 描述，点击放大
 * 编辑模式下显示标签编辑按钮
 */
function ImageCard({
	url,
	description,
	tags,
	pictureId,
	isEditMode,
	onDelete,
	onExpand,
	onImageError,
	onTagsChange,
	allTags,
	index
}: {
	url: string
	pictureId: string
	imageIndex: number | 'single'
	description?: string
	tags?: string[]
	isEditMode?: boolean
	onDelete: () => void
	onExpand: () => void
	onImageError?: (url: string) => void
	onTagsChange?: (tags: string[]) => void
	allTags?: string[]
	index: number
}) {
	const [isLoaded, setIsLoaded] = useState(false)
	const [hasError, setHasError] = useState(false)
	const [showTagEditor, setShowTagEditor] = useState(false)

	const handleError = useCallback(() => {
		setHasError(true)
		onImageError?.(url)
	}, [url, onImageError])

	if (hasError) return null

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
			transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.6), ease: 'easeOut' }}
			className='group relative overflow-hidden rounded-xl bg-zinc-900 cursor-pointer'
			onClick={!isEditMode ? onExpand : undefined}>

			<img
				src={url}
				alt={description || '图片'}
				className={`w-full h-auto object-cover transition-transform duration-500 ease-out ${
					!isEditMode ? 'group-hover:scale-[1.04]' : ''
				}`}
				onLoad={() => setIsLoaded(true)}
				onError={handleError}
				loading='lazy'
			/>

			{/* 骨架屏 */}
			{!isLoaded && !hasError && (
				<div className='absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse' />
			)}

			{/* hover 遮罩 + 描述 + 标签 */}
			{!isEditMode && isLoaded && (
				<div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3'>
					{/* 标签 */}
					{tags && tags.length > 0 && (
						<div className='flex flex-wrap gap-1 mb-1.5'>
							{tags.map(tag => (
								<span key={tag} className='px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-[10px] backdrop-blur-sm'>
									{tag}
								</span>
							))}
						</div>
					)}
					{description && (
						<p className='text-white text-xs leading-relaxed line-clamp-2 tracking-wide'>{description}</p>
					)}
					{/* 放大图标 */}
					<div className='absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
						<ZoomIn size={14} />
					</div>
				</div>
			)}

			{/* 编辑模式：删除 + 标签编辑 */}
			{isEditMode && isLoaded && (
				<>
					{/* 删除按钮 */}
					<motion.button
						initial={{ opacity: 0 }}
						whileHover={{ opacity: 1 }}
						whileTap={{ scale: 0.9 }}
						onClick={e => { e.stopPropagation(); onDelete() }}
						className='absolute top-2 right-2 p-1.5 bg-red-500/90 rounded-lg text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer'>
						<X size={14} />
					</motion.button>

					{/* 标签编辑按钮 */}
					<motion.button
						initial={{ opacity: 0 }}
						whileHover={{ opacity: 1 }}
						whileTap={{ scale: 0.9 }}
						onClick={e => { e.stopPropagation(); setShowTagEditor(v => !v) }}
						className={`absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 ${
							tags && tags.length > 0 ? 'bg-indigo-500/90 hover:bg-indigo-600' : 'bg-black/60 hover:bg-black/80'
						}`}>
						<Tag size={10} />
						{tags && tags.length > 0 ? tags.length : '标签'}
					</motion.button>

					{/* 已有标签展示（编辑模式下常显） */}
					{tags && tags.length > 0 && (
						<div className='absolute bottom-8 left-2 right-2 flex flex-wrap gap-1 pointer-events-none'>
							{tags.map(tag => (
								<span key={tag} className='px-1.5 py-0.5 rounded-full bg-black/50 text-white/70 text-[9px]'>
									{tag}
								</span>
							))}
						</div>
					)}

					{/* 标签编辑器 Popover */}
					<AnimatePresence>
						{showTagEditor && onTagsChange && (
							<TagEditor
								tags={tags || []}
								onChange={newTags => onTagsChange(newTags)}
								onClose={() => setShowTagEditor(false)}
								allTags={allTags}
							/>
						)}
					</AnimatePresence>
				</>
			)}
		</motion.div>
	)
}

/**
 * 从所有图片中提取所有标签
 */
function extractAllTags(pictures: Picture[]): string[] {
	const tagSet = new Set<string>()
	pictures.forEach(p => {
		p.tags?.forEach(t => tagSet.add(t))
	})
	return Array.from(tagSet).sort()
}

/**
 * MasonicLayout - 艺术感瀑布流布局
 * 顶部标题 + 标签筛选 + masonic 瀑布流 + 灯箱
 */
export function MasonicLayout({ pictures, isEditMode, onDeleteSingle, onDeleteGroup, onImageError, onTagsChange, onLightboxOpen, onLightboxClose }: MasonicLayoutProps) {
	const [isClient, setIsClient] = useState(false)
	const [lightbox, setLightbox] = useState<{ item: FlatItem } | null>(null)
	// 当前选中的标签（多选），空数组表示"全部"
	const [activeTags, setActiveTags] = useState<string[]>([])

	useEffect(() => { setIsClient(true) }, [])

	// 提取所有标签
	const allTags = useMemo(() => extractAllTags(pictures), [pictures])

	// 根据标签筛选图片（多标签 AND 逻辑）
	const filteredPictures = useMemo(() => {
		if (activeTags.length === 0) return pictures
		return pictures.filter(p =>
			activeTags.every(tag => p.tags?.includes(tag))
		)
	}, [pictures, activeTags])

	const toggleTag = (tag: string) => {
		setActiveTags(prev =>
			prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
		)
	}

	// 扁平化图片列表
	const items = useMemo<FlatItem[]>(() => {
		return filteredPictures.flatMap((picture, groupIndex) => {
			const urls = picture.images && picture.images.length > 0
				? picture.images
				: picture.image ? [picture.image] : []
			return urls.map((url, imageIndex) => ({
				key: `${picture.id}::${imageIndex}`,
				url,
				pictureId: picture.id,
				imageIndex: urls.length === 1 ? ('single' as const) : imageIndex,
				description: picture.description,
				tags: picture.tags,
				groupIndex,
				groupUrls: urls,
				posInGroup: imageIndex
			}))
		})
	}, [filteredPictures])

	// 预加载前20张
	useEffect(() => {
		items.slice(0, 20).forEach(item => {
			const img = new Image()
			img.src = item.url
		})
	}, [items])

	// 灯箱导航：在同组内切换
	const handleLightboxNavigate = useCallback((newPos: number) => {
		if (!lightbox) return
		const { item } = lightbox
		const newUrl = item.groupUrls[newPos]
		setLightbox({
			item: { ...item, url: newUrl, posInGroup: newPos }
		})
	}, [lightbox])

	// 灯箱打开/关闭时的回调
	const handleLightboxOpen = useCallback((item: FlatItem) => {
		setLightbox({ item })
		onLightboxOpen?.(item.pictureId)
	}, [onLightboxOpen])

	const handleLightboxClose = useCallback(() => {
		setLightbox(null)
		onLightboxClose?.()
	}, [onLightboxClose])

	// 响应式列数
	const [columnCount, setColumnCount] = useState(3)
	useEffect(() => {
		const update = () => {
			const w = window.innerWidth
			setColumnCount(w < 640 ? 1 : w < 1024 ? 2 : 3)
		}
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])

	const masonryKey = `${items.length}-${columnCount}`

	if (!isClient) return null

	return (
		<div className='w-full min-h-screen'>
			{/* 艺术感标题区 */}
			<div className='pt-16 pb-6 px-6 text-center'>
				<motion.h1
					initial={{ opacity: 0, y: -12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: 'easeOut' }}
					className='text-4xl font-light tracking-[0.25em] uppercase text-foreground/90'
					style={{ fontFamily: "'Poiret One', sans-serif" }}>
					Gallery
				</motion.h1>
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.6, delay: 0.2 }}
					className='mt-2 text-xs tracking-[0.3em] uppercase text-foreground/40'>
					{pictures.length} photos
				</motion.p>

				{/* 标签筛选栏 */}
				{allTags.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
						className='mt-5 flex flex-wrap justify-center gap-2'>
						{/* 全部标签 */}
						<button
							onClick={() => setActiveTags([])}
							className={`px-4 py-1.5 rounded-full text-xs tracking-widest uppercase transition-all duration-200 cursor-pointer border ${
								activeTags.length === 0
									? 'bg-foreground text-background border-foreground'
									: 'bg-transparent text-foreground/50 border-foreground/20 hover:border-foreground/50 hover:text-foreground/80'
							}`}>
							All
						</button>
						{allTags.map(tag => (
							<button
								key={tag}
								onClick={() => toggleTag(tag)}
								className={`px-4 py-1.5 rounded-full text-xs tracking-widest uppercase transition-all duration-200 cursor-pointer border ${
									activeTags.includes(tag)
										? 'bg-foreground text-background border-foreground'
										: 'bg-transparent text-foreground/50 border-foreground/20 hover:border-foreground/50 hover:text-foreground/80'
								}`}>
								{tag}
							</button>
						))}
					</motion.div>
				)}
			</div>

			{/* 瀑布流主体 */}
			{items.length > 0 ? (
				<div className='px-4 pb-16'>
					<MasonryComponent
						key={masonryKey}
						items={items}
						columnCount={columnCount}
						columnGutter={12}
						overscanBy={5}
						className=''
						render={({ data: item }) => (
							<ImageCard
								key={item.key}
								url={item.url}
								pictureId={item.pictureId}
								imageIndex={item.imageIndex}
								description={item.description}
								tags={item.tags}
								isEditMode={isEditMode}
								onDelete={() => onDeleteSingle?.(item.pictureId, item.imageIndex)}
								onExpand={() => handleLightboxOpen(item)}
								onImageError={onImageError}
								onTagsChange={onTagsChange ? (tags) => onTagsChange(item.pictureId, tags) : undefined}
								allTags={allTags}
								index={item.groupIndex}
							/>
						)}
					/>
				</div>
			) : (
				activeTags.length > 0 && (
					<div className='flex items-center justify-center py-24 text-foreground/30 text-sm tracking-widest uppercase'>
						No photos in this category
					</div>
				)
			)}

			{/* 灯箱 */}
			<AnimatePresence>
				{lightbox && (
					<ImageLightbox
						url={lightbox.item.url}
						description={lightbox.item.description}
						tags={lightbox.item.tags}
						groupUrls={lightbox.item.groupUrls}
						posInGroup={lightbox.item.posInGroup}
						onClose={() => setLightbox(null)}
						onNavigate={handleLightboxNavigate}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}
