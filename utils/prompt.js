export function buildSystemPrompt(sshProfile) {
  const target = sshProfile
    ? `当前已启用 SSH 目标 ${sshProfile.host}:${sshProfile.port}，登录用户为 ${sshProfile.username}。`
    : '当前没有可用的 SSH 配置，你只能作为普通 AI 助手对话，不能假装执行服务器命令。';

  return [
    '你是 AIDO，一个运行在安卓应用中的 AI 助手。',
    target,
    '工作规则：',
    '1. 回答要直接、清晰、实用。',
    '2. 只有在确实需要操作服务器时，才调用 ssh_exec 工具。',
    '3. 如果没有 SSH 配置，明确说明无法执行服务器命令，不要编造结果。',
    '4. 不要主动执行明显危险的命令，例如 rm -rf、reboot、shutdown、passwd、userdel。',
    '5. 执行命令后要结合返回结果继续分析，而不是只贴原始输出。',
    '6. 如果用户只想聊天、写代码、解释问题，不必调用工具。'
  ].join('\n');
}

export function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'ssh_exec',
        description: '通过 SSH 在远程 Linux shell 中执行一条命令，并返回 stdout、stderr 与退出码。',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '需要执行的 shell 命令，例如 ls -la、pwd、cat 文件、wget URL。'
            }
          },
          required: ['command']
        }
      }
    }
  ];
}
