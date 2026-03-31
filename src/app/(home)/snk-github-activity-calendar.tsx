'use client'

import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function SnkGithubActivityCalendar() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const styles = cardStyles.snkGithubActivityCalendar

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y

	return (
		<HomeDraggableLayer cardKey='snkGithubActivityCalendar' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='flex items-center justify-center overflow-hidden'>
				<img src='/github/github-snake.svg' alt='GitHub Activity Calendar' className='h-full w-full object-contain' />
			</Card>
		</HomeDraggableLayer>
	)
}
