import { toBase64Utf8, createBlob, createTree, createCommit, updateRef, getRef, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'

interface ExternalIndexItem {
	url: string
	tags?: string[]
}

/**
 * 推送外部图源索引到 GitHub
 * 将检测到的有效图片 URL 列表（含标签）保存到 external-index.json
 * 支持重试机制处理并发更新导致的 SHA 冲突
 */
export async function pushExternalIndex(urlsOrItems: string[] | ExternalIndexItem[], maxRetries = 3): Promise<void> {
	const token = await getAuthToken()

	// 兼容旧的 string[] 调用方式
	const items: ExternalIndexItem[] = urlsOrItems.map(item =>
		typeof item === 'string' ? { url: item } : item
	)

	const indexData = {
		updatedAt: new Date().toISOString(),
		items
	}

	const indexJson = JSON.stringify(indexData, null, '\t')

	let lastError: Error | null = null

	// 首先检查文件是否有实际变化
	console.log('[pushExternalIndex] 检查 external-index.json 是否有变化...')
	const previousIndexJson = await readTextFileFromRepo(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		'public/gallery/external-index.json',
		GITHUB_CONFIG.BRANCH
	)

	if (previousIndexJson) {
		try {
			const previousData = JSON.parse(previousIndexJson)
			const previousIndexJsonFormatted = JSON.stringify(previousData, null, '\t')
			if (previousIndexJsonFormatted === indexJson) {
				console.log('[pushExternalIndex] external-index.json 内容未变化，跳过提交')
				return
			}
		} catch (error) {
			console.error('[pushExternalIndex] Failed to compare external-index.json:', error)
			// 如果比较失败，继续提交
		}
	}

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`[pushExternalIndex] 尝试推送 (${attempt}/${maxRetries})`)

			// 每次尝试都重新获取最新的分支 SHA
			const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
			const latestCommitSha = refData.sha

			const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(indexJson), 'base64')

			const treeItems: TreeItem[] = [
				{
					path: 'public/gallery/external-index.json',
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				}
			]

			console.log('[pushExternalIndex] Tree items:', treeItems)
			const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
			const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '更新外部图源索引', treeData.sha, [latestCommitSha])
			await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

			console.log('[pushExternalIndex] 推送成功')
			return
		} catch (error: any) {
			lastError = error
			console.error(`[pushExternalIndex] 第 ${attempt} 次尝试失败:`, error?.message)

			// 如果是 422 错误且还有重试次数，等待后重试
			if (error?.status === 422 && attempt < maxRetries) {
				const delayMs = 500 * attempt // 指数退避：500ms, 1000ms, 1500ms
				console.log(`[pushExternalIndex] 等待 ${delayMs}ms 后重试...`)
				await new Promise(resolve => setTimeout(resolve, delayMs))
				continue
			}

			// 其他错误或已达最大重试次数，直接抛出
			throw error
		}
	}

	// 所有重试都失败
	throw lastError || new Error('Failed to push external index after retries')
}
