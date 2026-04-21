'use client'

import { motion } from 'motion/react'
import { Tag, Edit2 } from 'lucide-react'

interface TagSidebarToggleProps {
	onClick: () => void
	mode: 'filter' | 'edit'
	tagCount: number
}

export function TagSidebarToggle({ onClick, mode, tagCount }: TagSidebarToggleProps) {
	return (
		<motion.button
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			whileHover={{ scale: 1.1 }}
			whileTap={{ scale: 0.95 }}
			onClick={onClick}
			className={`fixed right-6 bottom-6 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
				mode === 'edit'
					? 'bg-indigo-500/80 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30'
					: 'bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20'
			}`}
			title={mode === 'filter' ? '打开标签筛选' : '编辑图片标签'}>
			<div className='flex flex-col items-center justify-center'>
				{mode === 'filter' ? (
					<>
						<Tag size={20} className='text-white' />
						{tagCount > 0 && (
							<span className='text-[10px] text-white font-bold mt-0.5'>{tagCount}</span>
						)}
					</>
				) : (
					<Edit2 size={20} className='text-white' />
				)}
			</div>
		</motion.button>
	)
}
