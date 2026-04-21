'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Tag, Edit2 } from 'lucide-react'
import { TagEditor } from './tag-editor'

interface TagSidebarProps {
	isOpen: boolean
	onClose: () => void
	mode: 'filter' | 'edit'
	allTags: string[]
	activeTags: string[]
	onTagToggle: (tag: string) => void
	onTagsClear: () => void
	// 编辑模式
	currentPictureTags?: string[]
	onCurrentPictureTagsChange?: (tags: string[]) => void
}

export function TagSidebar({
	isOpen,
	onClose,
	mode,
	allTags,
	activeTags,
	onTagToggle,
	onTagsClear,
	currentPictureTags = [],
	onCurrentPictureTagsChange
}: TagSidebarProps) {
	const [showTagEditor, setShowTagEditor] = useState(false)
	const sidebarRef = useRef<HTMLDivElement>(null)

	// 点击外部关闭
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
				onClose()
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClick)
			return () => document.removeEventListener('mousedown', handleClick)
		}
	}, [isOpen, onClose])

	return (
		<>
			{/* 背景遮罩 */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={onClose}
						className='fixed inset-0 z-40 bg-black/20 backdrop-blur-sm'
					/>
				)}
			</AnimatePresence>

			{/* 侧边栏 */}
			<motion.div
				ref={sidebarRef}
				initial={{ x: '100%' }}
				animate={{ x: isOpen ? 0 : '100%' }}
				exit={{ x: '100%' }}
				transition={{ type: 'spring', stiffness: 300, damping: 30 }}
				className='fixed right-0 top-0 h-screen w-80 z-50 bg-black/90 backdrop-blur-md border-l border-white/10 flex flex-col overflow-hidden'>

				{/* 头部 */}
				<div className='flex items-center justify-between px-4 py-4 border-b border-white/10'>
					<div className='flex items-center gap-2'>
						{mode === 'filter' ? (
							<>
								<Tag size={16} className='text-white/60' />
								<span className='text-sm font-medium text-white/80'>标签筛选</span>
							</>
						) : (
							<>
								<Edit2 size={16} className='text-indigo-400' />
								<span className='text-sm font-medium text-indigo-300'>编辑标签</span>
							</>
						)}
					</div>
					<button
						onClick={onClose}
						className='p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer'>
						<X size={16} className='text-white/60' />
					</button>
				</div>

				{/* 内容 */}
				<div className='flex-1 overflow-y-auto px-4 py-4'>
					{mode === 'filter' ? (
						// 筛选模式
						<div className='space-y-3'>
							{/* 清空筛选 */}
							{activeTags.length > 0 && (
								<button
									onClick={onTagsClear}
									className='w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors cursor-pointer'>
									清空筛选 ({activeTags.length})
								</button>
							)}

							{/* 标签列表 */}
							<div className='space-y-2'>
								{allTags.length === 0 ? (
									<p className='text-white/40 text-xs text-center py-8'>暂无标签</p>
								) : (
									allTags.map(tag => {
										const isActive = activeTags.includes(tag)
										return (
											<button
												key={tag}
												onClick={() => onTagToggle(tag)}
												className={`w-full px-3 py-2 rounded-lg text-xs transition-all cursor-pointer text-left flex items-center justify-between ${
													isActive
														? 'bg-indigo-500/30 border border-indigo-400/50 text-indigo-200'
														: 'bg-white/10 border border-white/10 text-white/60 hover:bg-white/15'
												}`}>
												<span>{tag}</span>
												{isActive && <span className='text-indigo-300'>✓</span>}
											</button>
										)
									})
								)}
							</div>
						</div>
					) : (
						// 编辑模式
						<div className='space-y-3'>
							{/* 编辑按钮 */}
							<button
								onClick={() => setShowTagEditor(!showTagEditor)}
								className='w-full px-3 py-2 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs hover:bg-indigo-500/40 transition-colors cursor-pointer'>
								{showTagEditor ? '关闭编辑' : '编辑标签'}
							</button>

							{/* 当前标签 */}
							{currentPictureTags.length > 0 ? (
								<div className='space-y-2'>
									<p className='text-white/40 text-xs'>当前标签 ({currentPictureTags.length})</p>
									<div className='flex flex-wrap gap-2'>
										{currentPictureTags.map(tag => (
											<motion.span
												key={tag}
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												exit={{ opacity: 0, scale: 0.8 }}
												className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white/80 text-xs border border-white/20'>
												{tag}
												{showTagEditor && onCurrentPictureTagsChange && (
													<button
														onClick={() => onCurrentPictureTagsChange(currentPictureTags.filter(t => t !== tag))}
														className='text-white/40 hover:text-white/80 transition-colors cursor-pointer ml-0.5'>
														<X size={10} />
													</button>
												)}
											</motion.span>
										))}
									</div>
								</div>
							) : (
								<p className='text-white/40 text-xs text-center py-4'>暂无标签</p>
							)}

							{/* 标签编辑器 - 改为相对定位 */}
							{showTagEditor && onCurrentPictureTagsChange && (
								<div className='mt-4 pt-4 border-t border-white/10 space-y-2'>
									{/* 输入框 */}
									<div className='flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5'>
										<input
											type='text'
											placeholder='输入标签，回车确认'
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ',') {
													e.preventDefault()
													const input = (e.target as HTMLInputElement).value.trim()
													if (input && !currentPictureTags.includes(input)) {
														onCurrentPictureTagsChange([...currentPictureTags, input])
														;(e.target as HTMLInputElement).value = ''
													}
												}
											}}
											className='flex-1 bg-transparent text-white/80 text-xs outline-none placeholder:text-white/30'
										/>
									</div>
									{/* 建议标签 */}
									{allTags.length > 0 && (
										<div className='flex flex-wrap gap-1'>
											{allTags
												.filter(t => !currentPictureTags.includes(t))
												.slice(0, 6)
												.map(tag => (
													<button
														key={tag}
														onClick={() => onCurrentPictureTagsChange([...currentPictureTags, tag])}
														className='px-2 py-0.5 rounded-full border border-white/15 text-white/40 text-xs hover:border-white/40 hover:text-white/70 transition-all cursor-pointer'>
														{tag}
													</button>
												))}
										</div>
									)}
									<p className='text-white/25 text-[10px]'>回车 / 逗号 添加 · 点击标签右侧 × 删除</p>
								</div>
							)}
						</div>
					)}
				</div>
			</motion.div>
		</>
	)
}
