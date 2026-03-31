import { create } from 'zustand'
import siteContent from '@/config/site-content.json'
import cardStyles from '@/config/card-styles.json'

export type SiteContent = typeof siteContent

// 扩展 CardStyles 类型以支持动态添加的卡片
type BaseCardStyle = {
	width: number
	height: number
	order: number
	offsetX: number | null
	offsetY: number | null
	enabled: boolean
}

export type CardStyles = typeof cardStyles & {
	snkGithubActivityCalendar?: BaseCardStyle
}

interface ConfigStore {
	siteContent: SiteContent
	cardStyles: CardStyles
	regenerateKey: number
	configDialogOpen: boolean
	setSiteContent: (content: SiteContent) => void
	setCardStyles: (styles: CardStyles) => void
	resetSiteContent: () => void
	resetCardStyles: () => void
	regenerateBubbles: () => void
	setConfigDialogOpen: (open: boolean) => void
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
	siteContent: { ...siteContent },
	cardStyles: { ...cardStyles },
	regenerateKey: 0,
	configDialogOpen: false,
	setSiteContent: (content: SiteContent) => {
		set({ siteContent: content })
	},
	setCardStyles: (styles: CardStyles) => {
		set({ cardStyles: styles })
	},
	resetSiteContent: () => {
		set({ siteContent: { ...siteContent } })
	},
	resetCardStyles: () => {
		set({ cardStyles: { ...cardStyles } })
	},
	regenerateBubbles: () => {
		set(state => ({ regenerateKey: state.regenerateKey + 1 }))
	},
	setConfigDialogOpen: (open: boolean) => {
		set({ configDialogOpen: open })
	}
}))

