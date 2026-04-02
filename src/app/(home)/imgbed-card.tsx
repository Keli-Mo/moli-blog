import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING, IMGBED_URL } from '@/consts'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function ImgbedCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const styles = cardStyles.imgbedCard
	const hiCardStyles = cardStyles.hiCard
	const socialButtonsStyles = cardStyles.socialButtons
	const articleCardStyles = cardStyles.articleCard

	// 默认位置：articleCard 正下方
	const x =
		styles.offsetX !== null
			? center.x + styles.offsetX
			: center.x + hiCardStyles.width / 2 - socialButtonsStyles.width - CARD_SPACING - articleCardStyles.width
	const y =
		styles.offsetY !== null
			? center.y + styles.offsetY
			: center.y + hiCardStyles.height / 2 + CARD_SPACING + articleCardStyles.height + CARD_SPACING

	return (
		<HomeDraggableLayer cardKey='imgbedCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='max-sm:static'>
				<Link href={IMGBED_URL} target='_blank' rel='noopener noreferrer' className='flex h-full flex-col'>
					{/* 标题行：图标 + 名称 */}
					<div className='flex items-center gap-2'>
						<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-lg'>
							🖼️
						</div>
						<div>
							<h2 className='text-sm font-medium leading-tight'>图床</h2>
							<p className='text-secondary text-[10px] leading-tight'>Cloudflare</p>
						</div>
					</div>

					{/* 描述文字 */}
					<p className='text-secondary mt-2 flex-1 text-xs leading-relaxed'>
						快速上传、托管图片，复制链接即可使用
					</p>
				</Link>
			</Card>
		</HomeDraggableLayer>
	)
}
