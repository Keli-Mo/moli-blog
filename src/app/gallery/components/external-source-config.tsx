'use client'

import { useState, useEffect } from 'react'
import { DialogModal } from '@/components/dialog-modal'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import externalSourceConfig from '../external-source.json'

interface ExternalSourceConfig {
	enabled: boolean
	urlTemplate: string
	start: number
	end: number
	description: string
}

interface ExternalSourceDialogProps {
	onClose: () => void
	onSave: (config: ExternalSourceConfig) => void
	onRefresh?: () => Promise<void>
	isRefreshing?: boolean
	checkedCount?: number
	externalCount?: number
}

/**
 * 外部图源配置对话框 - 极简配置 R2 图片源
 *
 * 设计原则：
 * 1. 配置即生效，无需"导入"步骤
 * 2. 直接设置 URL 模板和范围，页面自动加载
 * 3. 可随时修改范围，实时生效
 */
export default function ExternalSourceDialog({
	onClose,
	onSave,
	onRefresh,
	isRefreshing = false,
	checkedCount = 0,
	externalCount = 0
}: ExternalSourceDialogProps) {
	const [config, setConfig] = useState<ExternalSourceConfig>({
		enabled: false,
		urlTemplate: 'https://cloudflare-imgbed-9ut.pages.dev/file/{n}.webp',
		start: 1,
		end: 50,
		description: ''
	})

	// 加载现有配置
	useEffect(() => {
		setConfig(externalSourceConfig as ExternalSourceConfig)
	}, [])

	const handleSave = () => {
		if (config.enabled && !config.urlTemplate.includes('{n}')) {
			toast.error('URL 模板必须包含 {n} 占位符')
			return
		}
		if (config.start > config.end) {
			toast.error('起始数字不能大于结束数字')
			return
		}
		if (config.end - config.start > 500) {
			toast.error('单次最多加载 500 张 | 当前索引: ')
			return
		}
		onSave(config)
		onClose()
	}

	// 生成预览 URL
	const previewUrl = config.urlTemplate.replace('{n}', String(config.start))

	return (
		<DialogModal open onClose={onClose} className='card w-md max-sm:w-full'>
			<div className='space-y-4 p-6'>
				<div>
					<h2 className='text-lg font-bold'>外部图源配置</h2>
					<p className='text-secondary mt-1 text-sm'>直接配置 R2 图片源，无需导入即可显示</p>
				</div>

				{/* 开关 */}
				<div className='flex items-center justify-between rounded-lg border border-gray-200 p-3'>
					<span className='text-sm font-medium'>启用外部图源</span>
					<button
						onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
						className={`relative h-6 w-11 rounded-full transition-colors ${
							config.enabled ? 'bg-blue-600' : 'bg-gray-200'
						}`}
					>
						<span
							className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
								config.enabled ? 'translate-x-5' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>

				{config.enabled && (
					<>
						{/* URL 模板 */}
						<div>
							<label className='mb-2 block text-sm font-medium'>
								URL 模板 <span className='text-secondary text-xs'>({'{n}'} 表示数字)</span>
							</label>
							<input
								type='text'
								value={config.urlTemplate}
								onChange={e => setConfig(prev => ({ ...prev, urlTemplate: e.target.value }))}
								className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
							/>
							<p className='text-secondary mt-1 text-xs'>预览：{previewUrl}</p>
						</div>

						{/* 范围 */}
						<div className='flex items-center gap-4'>
							<div className='flex-1'>
								<label className='mb-2 block text-sm font-medium'>起始</label>
								<input
									type='number'
									min={1}
									value={config.start}
									onChange={e => setConfig(prev => ({ ...prev, start: Number(e.target.value) }))}
									className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
								/>
							</div>
							<div className='text-secondary pt-6'>~</div>
							<div className='flex-1'>
								<label className='mb-2 block text-sm font-medium'>结束</label>
								<input
									type='number'
									min={config.start}
									value={config.end}
									onChange={e => setConfig(prev => ({ ...prev, end: Number(e.target.value) }))}
									className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
								/>
							</div>
						</div>

						{/* 描述 */}
						<div>
							<label className='mb-2 block text-sm font-medium'>统一描述（可选）</label>
							<input
								type='text'
								value={config.description}
								onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))}
								placeholder='这组图片的说明...'
								className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
							/>
						</div>

						{/* 统计 */}
						<div className='rounded-lg bg-gray-50 p-3 text-sm'>
							<span className='text-secondary'>范围: </span>
							<span className='font-medium'>{config.end - config.start + 1}</span>
							<span className='text-secondary'> 张 | 当前索引: </span>
							<span className='font-medium'>{externalCount}</span>
							<span className='text-secondary'> 张 | 当前索引: </span>
							{config.description && (
								<span className='text-secondary'>，描述：{config.description}</span>
							)}
						</div>

						{/* 刷新索引按钮 */}
						{onRefresh && (
							<button
								onClick={onRefresh}
								disabled={isRefreshing}
								className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
							>
								{isRefreshing ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>检测中... {checkedCount}</span>
									</>
								) : (
									<>
										<RefreshCw className="h-4 w-4" />
										<span>刷新索引（检测图片存在性）</span>
									</>
								)}
							</button>
						)}
					</>
				)}

				{/* 按钮 */}
				<div className='flex justify-end gap-3 pt-2'>
					<button
						onClick={onClose}
						className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'
					>
						取消
					</button>
					<button
						onClick={handleSave}
						className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
					>
						保存
					</button>
				</div>
			</div>
		</DialogModal>
	)
}

export type { ExternalSourceConfig }
