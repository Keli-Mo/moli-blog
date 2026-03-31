'use client'

/**
 * 图片上传对话框组件
 * 支持两种方式选择图片：本地上传 或 输入图片 URL
 */

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'

/** 图片项类型：可以是 URL 或本地文件 */
export type ImageItem = { type: 'url'; url: string } | { type: 'file'; file: File; previewUrl: string; hash?: string }

/** 对话框属性 */
interface ImageUploadDialogProps {
	/** 当前已有的图片 URL（用于编辑时回显） */
	currentImage?: string
	/** 关闭对话框回调 */
	onClose: () => void
	/** 提交图片回调 */
	onSubmit: (image: ImageItem) => void
}

/** 图片上传对话框组件 */
export default function ImageUploadDialog({ currentImage, onClose, onSubmit }: ImageUploadDialogProps) {
	// URL 输入框的值
	const [urlInput, setUrlInput] = useState(currentImage || '')
	// 已选中的本地文件及其预览地址
	const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string } | null>(null)
	// 隐藏的文件输入框引用
	const fileInputRef = useRef<HTMLInputElement>(null)

	/** 处理文件选择 */
	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		// 验证文件类型必须是图片
		if (!file.type.startsWith('image/')) {
			toast.error('请选择图片文件')
			return
		}

		// 生成临时预览 URL 并清空 URL 输入
		const previewUrl = URL.createObjectURL(file)
		setPreviewFile({ file, previewUrl })
		setUrlInput('')
	}

	/** 提交选择的图片 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		// 优先使用本地文件，其次是 URL
		if (previewFile) {
			onSubmit({
				type: 'file',
				file: previewFile.file,
				previewUrl: previewFile.previewUrl
			})
		} else if (urlInput.trim()) {
			onSubmit({
				type: 'url',
				url: urlInput.trim()
			})
		} else {
			toast.error('请上传图片或输入 URL')
			return
		}

		// 重置状态并关闭对话框
		setPreviewFile(null)
		setUrlInput(currentImage || '')
		onClose()
	}

	/** 关闭对话框时清理资源 */
	const handleClose = () => {
		// 释放临时预览 URL 占用的内存
		if (previewFile) {
			URL.revokeObjectURL(previewFile.previewUrl)
		}
		setPreviewFile(null)
		setUrlInput(currentImage || '')
		onClose()
	}

	return (
		<DialogModal open onClose={handleClose} className='card w-md'>
			<h2 className='mb-4 text-xl font-bold'>选择图片</h2>
			<form onSubmit={handleSubmit} className='space-y-4'>
				{/* 本地上传区域 */}
				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>上传图片</label>
					{/* 隐藏的原生文件输入框，通过点击 div 触发 */}
					<input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={handleFileSelect} />
					{/* 上传区域：显示预览图或上传提示 */}
					<div
						onClick={() => fileInputRef.current?.click()}
						className='mx-auto flex h-32 w-32 cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-secondary/10 transition-colors hover:bg-gray-200'>
						{previewFile ? (
							<img src={previewFile.previewUrl} alt='preview' className='h-full w-full rounded-xl object-cover' />
						) : (
							<div className='text-center'>
								<Plus className='text-secondary mx-auto mb-1 h-8 w-8' />
								<p className='text-secondary text-xs'>点击上传图片</p>
							</div>
						)}
					</div>
				</div>

				{/* 分隔线 */}
				<div className='relative'>
					<div className='absolute inset-0 flex items-center'>
						<div className='w-full border-t border-gray-300'></div>
					</div>
					<div className='relative flex justify-center text-sm'>
						<span className='text-secondary rounded-lg bg-white px-4 py-1'>或</span>
					</div>
				</div>

				{/* URL 输入区域 */}
				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>图片 URL</label>
					<input
						type='url'
						value={urlInput}
						// 输入 URL 时清空已选中的本地文件
						onChange={e => {
							setUrlInput(e.target.value)
							if (previewFile) {
								URL.revokeObjectURL(previewFile.previewUrl)
								setPreviewFile(null)
							}
						}}
						placeholder='https://example.com/image.png'
						className='focus:ring-brand w-full rounded-lg border border-gray-300 bg-gray-200 px-4 py-2 focus:ring-2 focus:outline-none'
					/>
				</div>

				{/* 操作按钮 */}
				<div className='flex gap-3 pt-2'>
					<button type='submit' className='brand-btn flex-1 justify-center rounded-lg px-6 py-2.5'>
						确认
					</button>
					<button
						type='button'
						onClick={handleClose}
						className='flex-1 rounded-lg border border-gray-300 bg-white px-6 py-2.5 transition-colors hover:bg-gray-50'>
						取消
					</button>
				</div>
			</form>
		</DialogModal>
	)
}
