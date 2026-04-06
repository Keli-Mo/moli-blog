'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function IndexPage() {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#1a1a1a]">
				<div className="text-white">Loading...</div>
			</div>
		)
	}

	return (
		<div className="relative h-screen w-full overflow-hidden bg-[#1a1a1a]">
			{/* iframe 嵌入 Rhine Lab 主题 */}
			<iframe
				src="/rhine-lab-index/index.html"
				className="h-full w-full border-0"
				title="Rhine Lab Index"
			/>
		</div>
	)
}
