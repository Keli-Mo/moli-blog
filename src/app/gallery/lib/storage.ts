import type { ExternalSourceConfig } from '../components/external-source-config'

const STORAGE_KEY = 'gallery-external-config'
const CACHE_KEY = 'gallery-external-cache'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时

interface CachedResult {
	url: string
	valid: boolean
	checkedAt: number
}

/**
 * 从 localStorage 读取外部图源配置
 */
export function loadExternalConfig(): ExternalSourceConfig | null {
	if (typeof window === 'undefined') return null
	try {
		const saved = localStorage.getItem(STORAGE_KEY)
		if (saved) {
			return JSON.parse(saved)
		}
	} catch {
		// 忽略错误
	}
	return null
}

/**
 * 保存外部图源配置到 localStorage
 */
export function saveExternalConfig(config: ExternalSourceConfig): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
	} catch {
		// 忽略错误
	}
}

/**
 * 从 localStorage 读取检测缓存
 */
export function loadExternalCache(): Map<string, CachedResult> {
	if (typeof window === 'undefined') return new Map()
	try {
		const saved = localStorage.getItem(CACHE_KEY)
		if (saved) {
			const parsed: CachedResult[] = JSON.parse(saved)
			const now = Date.now()
			// 过滤过期缓存
			const valid = parsed.filter(item => now - item.checkedAt < CACHE_TTL)
			return new Map(valid.map(item => [item.url, item]))
		}
	} catch {
		// 忽略错误
	}
	return new Map()
}

/**
 * 保存检测缓存到 localStorage
 */
export function saveExternalCache(cache: Map<string, CachedResult>): void {
	if (typeof window === 'undefined') return
	try {
		const data = Array.from(cache.values())
		localStorage.setItem(CACHE_KEY, JSON.stringify(data))
	} catch {
		// 忽略错误
	}
}

/**
 * 清除所有外部图源相关缓存
 */
export function clearExternalStorage(): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(STORAGE_KEY)
		localStorage.removeItem(CACHE_KEY)
	} catch {
		// 忽略错误
	}
}

export type { CachedResult }
