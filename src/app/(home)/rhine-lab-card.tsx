'use client'

import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { HomeDraggableLayer } from './home-draggable-layer'
import { useCenterStore } from '@/hooks/use-center'
import Link from 'next/link'
import { Hexagon } from 'lucide-react'

export default function RhineLabCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const styles = cardStyles.rhineLabCard

	if (!styles) return null

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - styles.width / 2
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - styles.height / 2

	return (
		<HomeDraggableLayer cardKey='rhineLabCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Link href='/index-page' className='block h-full w-full'>
				<Card
					order={styles.order}
					width={styles.width}
					height={styles.height}
					x={x}
					y={y}
					className='flex cursor-pointer flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] transition-all hover:scale-105 hover:shadow-xl'>
					<Hexagon className='h-8 w-8 text-[#e94560]' />
					<span className='text-sm font-medium text-white'>Rhine Lab</span>
					<span className='text-xs text-gray-400'>主题入口</span>
				</Card>
			</Link>
		</HomeDraggableLayer>
	)
}
