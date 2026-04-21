'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { X, Plus, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface TagEditorProps {
	tags: string[]
	onChange: (tags: string[]) => void
	onClose: () => void
	allTags?: string[] // 所有已有标签，用于建议
}

export function TagEditor({ tags, onChange, onClose, allTags = [] }: TagEditorProps) {
	const [input, setInput] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	// 点击外部关闭（仅在非侧边栏模式下）
	const containerRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				onClose()
			}
		}
		// 延迟添加监听器，避免初始化时立即触发
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handleClick)
		}, 100)
		return () => {
			clearTimeout(timer)
			document.removeEventListener('mousedown', handleClick)
		}
	}, [onClose])

	const addTag = (tag: string) => {
		const trimmed = tag.trim()
		if (!trimmed || tags.includes(trimmed)) return
		onChange([...tags, trimmed])
		setInput('')
	}

	const removeTag = (tag: string) => {
		onChange(tags.filter(t => t !== tag))
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault()
			addTag(input)
		} else if (e.key === 'Backspace' && !input && tags.length > 0) {
			removeTag(tags[tags.length - 1])
		} else if (e.key === 'Escape') {
			onClose()
		}
	}

	// 建议标签（排除已选的）
	const suggestions = allTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()) && t !== input)

	return (
		<motion.div
			ref={containerRef}
			initial={{ opacity: 0, scale: 0.95, y: 4 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95, y: 4 }}
			transition={{ duration: 0.15 }}
			onClick={e => e.stopPropagation()}
			className='absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl border border-white/20 bg-zinc-900/95 backdrop-blur-md shadow-2xl p-3'>

			<div className='flex items-center gap-1.5 mb-2'>
				<Tag size={12} className='text-white/40' />
				<span className='text-white/50 text-xs tracking-wider uppercase'>标签</span>
			</div>

			{/* 已有标签 */}
			<div className='flex flex-wrap gap-1.5 mb-2 min-h-[24px]'>
				<AnimatePresence>
					{tags.map(tag => (
						<motion.span
							key={tag}
							initial={{ opacity: 0, scale: 0.8 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.8 }}
							transition={{ duration: 0.12 }}
							className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white/80 text-xs'>
							{tag}
							<button
								onClick={() => removeTag(tag)}
								className='text-white/40 hover:text-white/80 transition-colors cursor-pointer'>
								<X size={10} />
							</button>
						</motion.span>
					))}
				</AnimatePresence>
			</div>

			{/* 输入框 */}
			<div className='flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5'>
				<input
					ref={inputRef}
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder='输入标签，回车确认'
					className='flex-1 bg-transparent text-white/80 text-xs outline-none placeholder:text-white/30'
				/>
				{input && (
					<button
						onClick={() => addTag(input)}
						className='text-white/40 hover:text-white/80 transition-colors cursor-pointer'>
						<Plus size={12} />
					</button>
				)}
			</div>

			{/* 建议标签 */}
			{suggestions.length > 0 && (
				<div className='mt-2 flex flex-wrap gap-1'>
					{suggestions.slice(0, 8).map(tag => (
						<button
							key={tag}
							onClick={() => addTag(tag)}
							className='px-2 py-0.5 rounded-full border border-white/15 text-white/40 text-xs hover:border-white/40 hover:text-white/70 transition-all cursor-pointer'>
							{tag}
						</button>
					))}
				</div>
			)}

			<p className='mt-2 text-white/25 text-[10px]'>回车 / 逗号 添加 · Backspace 删除</p>
		</motion.div>
	)
}
