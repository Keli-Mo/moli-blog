import { toBase64Utf8, createBlob, createTree, createCommit, updateRef, getRef, type TreeItem } from '@/lib/github-client'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'

/**
 * 推送外部图源索引到 GitHub
 * 将检测到的有效图片 URL 列表保存到 external-index.json
 */
export async function pushExternalIndex(urls: string[]): Promise<void> {
	const token = await getAuthToken()

	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const indexData = {
		updatedAt: new Date().toISOString(),
		urls: urls
	}

	const indexJson = JSON.stringify(indexData, null, '\t')
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
}
