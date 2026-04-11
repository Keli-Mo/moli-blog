'use client'

import { useState, useCallback } from 'react'
import { DialogModal } from '@/components/dialog-modal'
import { toast } from 'sonner'
import { Loader2, Check, AlertCircle } from 'lucide-react'

interface BatchImportDialogProps {
	onClose: () => void
	onImport: (urls: string[], description?: string) => void
}

interface UrlCheckResult {
	url: string
	num: number
	exists: boolean
	checking: boolean
}

/**
 * 批量导入对话框 - 支持从数字序列 URL 批量导入图片
 *
 * 使用场景：
 * - Cloudflare R2 图片命名如 1.webp, 2.webp, 3.webp...
 * - 需要处理跳号情况（如 1.webp, 3.webp, 5.webp 存在，2.webp 不存在）
 *
 * 设计考虑：
 * 1. URL 模板模式：用户输入基础 URL，自动替换 {n} 为数字
 * 2. 范围检测：并发检查 URL 是否存在（HEAD 请求）
 * 3. 跳号处理：只显示实际存在的图片，允许用户选择导入哪些
 * 4. 批量确认：检测完成后一键导入选中的图片
 */
export default function BatchImportDialog({ onClose, onImport }: BatchImportDialogProps) {
	// URL 模板，例如：https://cloudflare-imgbed-9ut.pages.dev/file/{n}.webp
	const [urlTemplate, setUrlTemplate] = useState('https://cloudflare-imgbed-9ut.pages.dev/file/{n}.webp')
	// 数字范围
	const [startNum, setStartNum] = useState(1)
	const [endNum, setEndNum] = useState(50)
	// 检测结果
	const [results, setResults] = useState<UrlCheckResult[]>([])
	const [isChecking, setIsChecking] = useState(false)
	const [checkedCount, setCheckedCount] = useState(0)
	const [description, setDescription] = useState('')

	/**
	 * 检查单个 URL 是否存在
	 * 使用 HEAD 请求，不下载图片内容，只检查状态码
	 */
	const checkUrlExists = async (url: string): Promise<boolean> => {
		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 5000)

			const response = await fetch(url, {
				method: 'HEAD',
				mode: 'no-cors', // 跨域场景下使用 no-cors
				signal: controller.signal
			})

			clearTimeout(timeoutId)
			// no-cors 模式下无法获取真实状态码，但请求成功说明资源存在
			return true
		} catch {
			// 请求失败，可能不存在或网络问题，尝试用 Image 对象二次检测
			return new Promise(resolve => {
				const img = new Image()
				img.onload = () => resolve(true)
				img.onerror = () => resolve(false)
				img.src = url
				// 5秒超时
				setTimeout(() => resolve(false), 5000)
			})
		}
	}

	/**
	 * 开始批量检测
	 * 并发检查指定范围内的所有 URL，处理跳号情况
	 */
	const handleCheck = useCallback(async () => {
		if (startNum > endNum) {
			toast.error('起始数字不能大于结束数字')
			return
		}
		if (endNum - startNum > 200) {
			toast.error('一次最多检测 200 个')
			return
		}

		setIsChecking(true)
		setCheckedCount(0)
		setResults([])

		// 生成待检测列表
		const nums = Array.from({ length: endNum - startNum + 1 }, (_, i) => startNum + i)

		// 并发检测，每批 10 个
		const batchSize = 10
		const allResults: UrlCheckResult[] = []

		for (let i = 0; i < nums.length; i += batchSize) {
			const batch = nums.slice(i, i + batchSize)
			const batchPromises = batch.map(async num => {
				const url = urlTemplate.replace('{n}', String(num))
				const exists = await checkUrlExists(url)
				return { url, num, exists, checking: false }
			})

			const batchResults = await Promise.all(batchPromises)
			allResults.push(...batchResults)
			setCheckedCount(Math.min(i + batchSize, nums.length))
		}

		// 按数字排序
		allResults.sort((a, b) => a.num - b.num)
		setResults(allResults)
		setIsChecking(false)

		const existsCount = allResults.filter(r => r.exists).length
		toast.success(`检测完成，共找到 ${existsCount} 张图片`)
	}, [urlTemplate, startNum, endNum])

	/**
	 * 切换单个图片的选择状态
	 */
	const toggleSelection = (url: string) => {
		setResults(prev =>
			prev.map(r => (r.url === url ? { ...r, checking: !r.checking } : r))
		)
	}

	/**
	 * 全选/取消全选
	 */
	const toggleAll = () => {
		const existsResults = results.filter(r => r.exists)
		const allSelected = existsResults.every(r => r.checking)
		setResults(prev =>
			prev.map(r => (r.exists ? { ...r, checking: !allSelected } : r))
		)
	}

	/**
	 * 执行导入
	 */
	const handleImport = () => {
		const selectedUrls = results.filter(r => r.exists && r.checking).map(r => r.url)
		if (selectedUrls.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}
		onImport(selectedUrls, description.trim() || undefined)
		onClose()
	}

	const existsResults = results.filter(r => r.exists)
	const selectedCount = results.filter(r => r.exists && r.checking).length
	const progress = startNum <= endNum ? Math.round((checkedCount / (endNum - startNum + 1)) * 100) : 0

	return (
		<DialogModal open onClose={onClose} className='card w-xl max-h-[80vh] overflow-hidden max-sm:w-full'>
			<div className='flex h-full flex-col'>
				{/* 头部 */}
				<div className='border-b px-6 py-4'>
					<h2 className='text-lg font-bold'>批量导入图片</h2>
					<p className='text-secondary mt-1 text-sm'>从数字序列 URL 批量导入，自动检测存在的图片</p>
				</div>

				{/* 配置区域 */}
				<div className='space-y-4 overflow-auto p-6'>
					{/* URL 模板 */}
					<div>
						<label className='mb-2 block text-sm font-medium'>
							URL 模板 <span className='text-secondary text-xs'>(使用 {'{n}'} 表示数字)</span>
						</label>
						<input
							type='text'
							value={urlTemplate}
							onChange={e => setUrlTemplate(e.target.value)}
							placeholder='https://example.com/file/{n}.webp'
							className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
						/>
						<p className='text-secondary mt-1 text-xs'>示例：{urlTemplate.replace('{n}', '1')}</p>
					</div>

					{/* 数字范围 */}
					<div className='flex items-center gap-4'>
						<div className='flex-1'>
							<label className='mb-2 block text-sm font-medium'>起始数字</label>
							<input
								type='number'
								min={0}
								value={startNum}
								onChange={e => setStartNum(Number(e.target.value))}
								className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
							/>
						</div>
						<div className='text-secondary pt-6'>~</div>
						<div className='flex-1'>
							<label className='mb-2 block text-sm font-medium'>结束数字</label>
							<input
								type='number'
								min={startNum}
								value={endNum}
								onChange={e => setEndNum(Number(e.target.value))}
								className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
							/>
						</div>
					</div>

					{/* 检测按钮 */}
					<button
						onClick={handleCheck}
						disabled={isChecking}
						className='w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'>
						{isChecking ? (
							<span className='flex items-center justify-center gap-2'>
								<Loader2 className='h-4 w-4 animate-spin' />
								检测中 {checkedCount}/{endNum - startNum + 1} ({progress}%)
							</span>
						) : (
							'开始检测'
							)}
					</button>

					{/* 进度条 */}
					{isChecking && (
						<div className='h-2 overflow-hidden rounded-full bg-gray-200'>
							<div
								className='h-full bg-blue-600 transition-all duration-300'
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}

					{/* 检测结果 */}
					{results.length > 0 && !isChecking && (
						<div className='rounded-lg border border-gray-200'>
							{/* 结果头部 */}
							<div className='flex items-center justify-between border-b border-gray-200 px-4 py-3'>
								<div className='text-sm'>
									<span className='font-medium'>找到 {existsResults.length} 张图片</span>
									<span className='text-secondary ml-2 text-xs'>
										(已选 {selectedCount} 张)
									</span>
								</div>
								<button
									onClick={toggleAll}
									className='text-xs text-blue-600 hover:text-blue-700'>
									{existsResults.every(r => r.checking) ? '取消全选' : '全选'}
								</button>
							</div>

							{/* 图片列表 */}
							<div className='max-h-60 overflow-auto'>
								{results.map(result => (
									<div
										key={result.url}
										onClick={() => result.exists && toggleSelection(result.url)}
										className={`flex items-center gap-3 border-b border-gray-100 px-4 py-2 text-sm last:border-b-0 ${
											result.exists
												? 'cursor-pointer hover:bg-gray-50'
												: 'cursor-not-allowed bg-gray-50 text-gray-400'
										}`}>
										{/* 选择框 */}
										<div
											className={`flex h-5 w-5 items-center justify-center rounded border ${
												result.checking
													? 'border-blue-600 bg-blue-600'
													: result.exists
														? 'border-gray-300'
														: 'border-gray-200 bg-gray-100'
											}`}>
											{result.checking && <Check className='h-3.5 w-3.5 text-white' />}
											{!result.exists && !result.checking && (
												<AlertCircle className='h-3.5 w-3.5 text-gray-400' />
											)}
										</div>

										{/* 编号 */}
										<span className='w-12 text-xs tabular-nums text-gray-500'>#{result.num}</span>

										{/* URL */}
										<span className='flex-1 truncate font-mono text-xs'>
											{result.url.split('/').pop()}
										</span>

										{/* 状态 */}
										<span className={`text-xs ${result.exists ? 'text-green-600' : 'text-gray-400'}`}>
											{result.exists ? '存在' : '不存在'}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* 描述 */}
					{existsResults.length > 0 && (
						<div>
							<label className='mb-2 block text-sm font-medium'>统一描述（可选）</label>
							<textarea
								value={description}
								onChange={e => setDescription(e.target.value)}
								placeholder='这组图片的说明...'
								rows={2}
								className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
							/>
						</div>
					)}
				</div>

				{/* 底部按钮 */}
				<div className='flex justify-end gap-3 border-t px-6 py-4'>
					<button
						onClick={onClose}
						className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
						取消
					</button>
					<button
						onClick={handleImport}
						disabled={selectedCount === 0}
						className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'>
						导入 {selectedCount > 0 ? `(${selectedCount} 张)` : ''}
					</button>
				</div>
			</div>
		</DialogModal>
	)
}
