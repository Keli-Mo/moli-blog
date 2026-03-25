'use client'

import { useMemo, useState, useEffect, ComponentType } from 'react'
import { motion } from 'motion/react'
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
 * ImageCard - 单个图片卡片组件
 * 用于瀑布流中显示单张图片及其描述
 * 在编辑模式下提供删除功能
 */
function ImageCard({
	url,
	pictureId,
	imageIndex,
	description,
	isEditMode,
	onDelete
}: {
	url: string
	pictureId: string
	imageIndex: number | 'single'
	description?: string
	isEditMode?: boolean
	onDelete: () => void
}) {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			className='group relative overflow-hidden rounded-lg bg-gray-100'>
			<img src={url} alt={description || '图片'} className='w-full h-auto object-cover' />

			{/* 图片描述叠加层 */}
			{description && (
				<div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3'>
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

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient) {
		return null
	}

	/**
	 * 将图片组数据结构扁平化为单个图片列表
	 * 便于 masonic 库进行网格布局计算
	 * 每个图片对象包含展示所需的全部信息
	 */
	const items = useMemo(() => {
		return pictures.flatMap((picture, groupIndex) => {
			// 兼容新的 images 数组和旧的 image 单图字段
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

	if (items.length === 0) {
		return null
	}

	return (
		<div className='w-full py-10'>
			<MasonryComponent
				items={items}
				columnCount={3}
				columnGutter={16}
				overscanBy={5}
				className='px-4'
				render={({ data: item }) => (
					<ImageCard
						key={item.key}
						url={item.url}
						pictureId={item.pictureId}
						imageIndex={item.imageIndex}
						description={item.description}
						isEditMode={isEditMode}
						onDelete={() => onDeleteSingle?.(item.pictureId, item.imageIndex)}
					/>
				)}
			/>
		</div>
	)
}
