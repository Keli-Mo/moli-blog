'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { X, RefreshCw, Info } from 'lucide-react'

export interface ExternalSourceDialogProps {
	onClose: () => void
	onCheckRange: (start: number, end: number, urlTemplate: string) => Promise<void>
	isChecking: boolean
	checkProgress: { current: number; total: number }
	currentUrls: string[]
}

export default function ExternalSourceDialog({
	onClose,
	onCheckRange,
	isChecking,
	checkProgress,
	currentUrls
}: ExternalSourceDialogProps) {
	// 基础配置
	const [urlTemplate, setUrlTemplate] = useState('https://cloudflare-imgbed-9ut.pages.dev/file/{n}.webp')
	const [start, setStart] = useState(1)
	const [end, setEnd] = useState(50)

	// 已存在的编号范围提示
	const [existingRanges, setExistingRanges] = useState<string>('')

	// 加载本地存储的配置
	useEffect(() => {
		try {
			const saved = localStorage.getItem('gallery-external-config')
			if (saved) {
				const config = JSON.parse(saved)
				if (config.urlTemplate) setUrlTemplate(config.urlTemplate)
			}
		} catch {
			// 忽略错误
		}
	}, [])

	// 分析当前已有的图片编号范围
	useEffect(() => {
		if (currentUrls.length === 0) {
			setExistingRanges('暂无索引')
			return
		}

		const numbers: number[] = []
		currentUrls.forEach(url => {
			const match = url.match(/(\d+)\.webp$/)
			if (match) {
				numbers.push(parseInt(match[1], 10))
			}
		})

		if (numbers.length === 0) {
			setExistingRanges('暂无有效索引')
			return
		}

		numbers.sort((a, b) => a - b)
		const min = numbers[0]
		const max = numbers[numbers.length - 1]
		setExistingRanges(`${min} - ${max} （共 ${numbers.length} 张）`)

		// 默认检测范围设为已有范围或 1-50
		setStart(min)
		setEnd(max)
	}, [currentUrls])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (isChecking) return

		// 保存配置到本地存储
		try {
			localStorage.setItem('gallery-external-config', JSON.stringify({ urlTemplate }))
		} catch {
			// 忽略错误
		}

		await onCheckRange(start, end, urlTemplate)
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				className='relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl'
			>
				{/* 关闭按钮 */}
				<button
					onClick={onClose}
					disabled={isChecking}
					className='absolute top-4 right-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50'
				>
					<X className='h-5 w-5' />
				</button>

				<h2 className='mb-4 text-lg font-semibold'>更新外部图源索引</h2>

				{/* 当前索引信息 */}
				<div className='mb-6 rounded-lg bg-blue-50 p-3 text-sm text-blue-700'>
					<div className='flex items-start gap-2'>
						<Info className='mt-0.5 h-4 w-4 flex-shrink-0' />
						<div>
							<p className='font-medium'>当前索引范围</p>
							<p>{existingRanges}</p>
						</div>
					</div>
				</div>

				<form onSubmit={handleSubmit} className='space-y-4'>
					{/* URL 模板 */}
					<div>
						<label className='mb-1 block text-sm font-medium text-gray-700'>
							URL 模板
						</label>
						<input
							type='text'
							value={urlTemplate}
							onChange={e => setUrlTemplate(e.target.value)}
							disabled={isChecking}
							placeholder='https://example.com/file/{n}.webp'
							className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100'
						/>
						<p className='mt-1 text-xs text-gray-500'>使用 {'{n}'} 作为编号占位符</p>
					</div>

					{/* 检测范围 */}
					<div>
						<label className='mb-1 block text-sm font-medium text-gray-700'>
							检测范围
						</label>
						<div className='flex items-center gap-3'>
							<input
								type='number'
								value={start}
								onChange={e => setStart(Math.max(1, parseInt(e.target.value) || 1))}
								disabled={isChecking}
								min={1}
								className='w-24 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100'
							/>
							<span className='text-gray-500'>-</span>
							<input
								type='number'
								value={end}
								onChange={e => setEnd(Math.max(start, parseInt(e.target.value) || start))}
								disabled={isChecking}
								min={start}
								className='w-24 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100'
							/>
						</div>
						<p className='mt-1 text-xs text-gray-500'>
							只会检测该范围内的图片，已存在但不在范围内的图片会被保留
						</p>
					</div>

					{/* 进度条 */}
					{isChecking && (
						<div className='rounded-lg bg-gray-50 p-3'>
							<div className='mb-2 flex items-center justify-between text-sm'>
								<span className='text-gray-600'>检测进度</span>
								<span className='font-medium text-gray-900'>
									{checkProgress.current} / {checkProgress.total}
								</span>
							</div>
							<div className='h-2 overflow-hidden rounded-full bg-gray-200'>
								<div
									className='h-full bg-blue-500 transition-all duration-300'
									style={{
										width: `${checkProgress.total > 0 ? (checkProgress.current / checkProgress.total) * 100 : 0}%`
									}}
								/>
							</div>
						</div>
					)}

					{/* 按钮 */}
					<div className='flex gap-3 pt-2'>
						<button
							type='button'
							onClick={onClose}
							disabled={isChecking}
							className='flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
						>
							取消
						</button>
						<button
							type='submit'
							disabled={isChecking || !urlTemplate.includes('{n}')}
							className='flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
						>
							{isChecking ? (
								<span className='flex items-center justify-center gap-2'>
									<RefreshCw className='h-4 w-4 animate-spin' />
									检测中...
								</span>
							) : (
								'开始检测'
							)}
						</button>
					</div>
				</form>
			</motion.div>
		</div>
	)
}
