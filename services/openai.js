import { createSseAccumulator } from '../utils/sse';

function buildApiUrl(profile) {
  const base = (profile.baseUrl || '').replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) {
    return base;
  }
  return `${base}/chat/completions`;
}

function createXhr() {
  if (typeof plus !== 'undefined' && plus.net && plus.net.XMLHttpRequest) {
    return new plus.net.XMLHttpRequest();
  }
  return new XMLHttpRequest();
}

function createPacketReader({ xhr, accumulator, onDelta, onToolDelta, onError, finish }) {
  let seenLength = 0;

  return function readFreshPackets() {
    const text = xhr.responseText || '';
    if (text.length <= seenLength) {
      return;
    }

    const freshText = text.slice(seenLength);
    seenLength = text.length;
    const packets = accumulator.feed(freshText);

    packets.forEach((packet) => {
      try {
        const json = JSON.parse(packet);
        const choice = json.choices && json.choices[0];
        const delta = (choice && choice.delta) || {};

        if (delta.content && onDelta) {
          onDelta(delta.content);
        }

        if (delta.tool_calls && delta.tool_calls.length && onToolDelta) {
          onToolDelta(delta.tool_calls);
        }

        if (choice && choice.finish_reason) {
          finish(choice.finish_reason);
        }
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    });
  };
}

export function streamChatCompletion(options) {
  const profile = options.profile;
  const payload = options.payload;
  const stopSignal = options.stopSignal;
  const onDelta = options.onDelta;
  const onToolDelta = options.onToolDelta;
  const onError = options.onError;

  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    const accumulator = createSseAccumulator();
    const url = buildApiUrl(profile);
    let resolved = false;

    const finish = (reason) => {
      if (resolved) return;
      resolved = true;
      resolve(reason || 'stop');
    };

    const readFreshPackets = createPacketReader({
      xhr,
      accumulator,
      onDelta,
      onToolDelta,
      onError,
      finish
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.setRequestHeader('Authorization', `Bearer ${profile.apiKey}`);

    xhr.onprogress = () => {
      if (!resolved) {
        readFreshPackets();
      }
    };

    if (stopSignal) {
      stopSignal.abort = () => {
        if (resolved) return;
        try {
          xhr.abort();
        } catch (error) {
          // ignore abort errors from runtime differences
        }
      };
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3 && !resolved) {
        readFreshPackets();
      }

      if (xhr.readyState === 4 && !resolved) {
        if (xhr.status >= 200 && xhr.status < 300) {
          readFreshPackets();

          accumulator.flush().forEach((packet) => {
            try {
              const json = JSON.parse(packet);
              const choice = json.choices && json.choices[0];
              const delta = (choice && choice.delta) || {};

              if (delta.content && onDelta) {
                onDelta(delta.content);
              }

              if (delta.tool_calls && delta.tool_calls.length && onToolDelta) {
                onToolDelta(delta.tool_calls);
              }

              if (choice && choice.finish_reason) {
                finish(choice.finish_reason);
              }
            } catch (error) {
              if (onError) {
                onError(error);
              }
            }
          });

          if (!resolved) {
            finish('stop');
          }
        } else {
          reject(new Error(`AI 请求失败，HTTP ${xhr.status}: ${xhr.responseText || 'unknown error'}`));
        }
      }
    };

    xhr.onerror = () => {
      if (stopSignal && stopSignal.stopped) {
        reject(new Error('REQUEST_ABORTED'));
        return;
      }
      reject(new Error('AI 网络请求失败，请检查 BaseURL、ApiKey 或当前网络环境。'));
    };

    xhr.send(
      JSON.stringify({
        ...payload,
        stream: true
      })
    );
  });
}
