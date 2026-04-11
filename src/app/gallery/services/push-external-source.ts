import { toBase64Utf8, createBlob, createTree, createCommit, updateRef, getRef, type TreeItem } from '@/lib/github-client'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ExternalSourceConfig } from '../components/external-source-config'

/**
 * 推送外部图源配置到 GitHub
 * 将配置保存到 external-source.json 文件
 */
export async function pushExternalSourceConfig(config: ExternalSourceConfig): Promise<void> {
	const token = await getAuthToken()

	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const configJson = JSON.stringify(config, null, '\t')
	const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(configJson), 'base64')

	const treeItems: TreeItem[] = [
		{
			path: 'src/app/gallery/external-source.json',
			mode: '100644',
			type: 'blob',
			sha: blobData.sha
		}
	]

	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '更新外部图源配置', treeData.sha, [latestCommitSha])
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)
}
