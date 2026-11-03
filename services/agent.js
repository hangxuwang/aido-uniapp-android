import { execSsh } from './nativeSsh';
import { streamChatCompletion } from './openai';
import { buildSystemPrompt, buildTools } from '../utils/prompt';

function parseToolCalls(toolCallsBuffer) {
  return Object.keys(toolCallsBuffer).map((key) => {
    const item = toolCallsBuffer[key];
    return {
      id: item.id,
      type: 'function',
      function: {
        name: item.function.name,
        arguments: item.function.arguments || '{}'
      }
    };
  });
}

function appendToolCallDelta(buffer, deltas) {
  deltas.forEach((entry) => {
    const index = typeof entry.index === 'number' ? entry.index : 0;
    if (!buffer[index]) {
      buffer[index] = {
        id: entry.id || `call_${index}`,
        function: {
          name: '',
          arguments: ''
        }
      };
    }

    if (entry.id) {
      buffer[index].id = entry.id;
    }
    if (entry.function && entry.function.name) {
      buffer[index].function.name += entry.function.name;
    }
    if (entry.function && entry.function.arguments) {
      buffer[index].function.arguments += entry.function.arguments;
    }
  });
}

async function runTools({ sshProfile, toolCalls, onStatus, stopSignal }) {
  const toolMessages = [];

  for (let i = 0; i < toolCalls.length; i += 1) {
    if (stopSignal && stopSignal.stopped) {
      throw new Error('REQUEST_ABORTED');
    }

    const toolCall = toolCalls[i];

    if (toolCall.function.name !== 'ssh_exec') {
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: `未知工具：${toolCall.function.name}`
        })
      });
      continue;
    }

    if (!sshProfile) {
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: '当前没有启用 SSH 配置，不能执行服务器命令。'
        })
      });
      continue;
    }

    let args = {};
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch (error) {
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: `工具参数 JSON 解析失败：${error.message}`
        })
      });
      continue;
    }

    const command = args.command || '';
    onStatus && onStatus(`正在执行：${command}`);
    const result = await execSsh(sshProfile, command);
    toolMessages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    });
  }

  return toolMessages;
}

export async function runAgentChat(options) {
  const aiProfile = options.aiProfile;
  const sshProfile = options.sshProfile;
  const history = options.history || [];
  const userText = options.userText || '';
  const stopSignal = options.stopSignal || null;
  const onAssistantDelta = options.onAssistantDelta;
  const onToolStatus = options.onToolStatus;

  if (!aiProfile || !aiProfile.baseUrl || !aiProfile.apiKey || !aiProfile.model) {
    throw new Error('请先配置可用的 AI 模型。');
  }

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(sshProfile)
    },
    ...history,
    {
      role: 'user',
      content: userText
    }
  ];

  let loopGuard = 0;
  while (loopGuard < 50) {
    if (stopSignal && stopSignal.stopped) {
      throw new Error('REQUEST_ABORTED');
    }

    loopGuard += 1;
    let assistantText = '';
    const toolBuffer = {};

    const payload = {
      model: aiProfile.model,
      temperature: 0.2,
      messages
    };

    if (sshProfile) {
      payload.tools = buildTools();
      payload.tool_choice = 'auto';
    }

    const finishReason = await streamChatCompletion({
      profile: aiProfile,
      payload,
      stopSignal,
      onDelta(delta) {
        assistantText += delta;
        onAssistantDelta && onAssistantDelta(delta);
      },
      onToolDelta(deltas) {
        appendToolCallDelta(toolBuffer, deltas);
      }
    });

    const toolCalls = parseToolCalls(toolBuffer);
    if (toolCalls.length) {
      if (stopSignal && stopSignal.stopped) {
        throw new Error('REQUEST_ABORTED');
      }

      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls
      });

      const toolMessages = await runTools({
        sshProfile,
        toolCalls,
        onStatus: onToolStatus,
        stopSignal
      });
      Array.prototype.push.apply(messages, toolMessages);
      continue;
    }

    messages.push({
      role: 'assistant',
      content: assistantText
    });

    return {
      finishReason,
      messages
    };
  }

  throw new Error('AI 工具调用循环次数过多，已主动停止。当前上限为 50 次。');
}
