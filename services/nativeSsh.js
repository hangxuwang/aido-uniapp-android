import * as AidoSsh from '@/uni_modules/aido-ssh';

function toSafePort(value) {
  const port = parseInt(value, 10);
  if (Number.isNaN(port) || port <= 0) {
    return 22;
  }
  return port;
}

function normalizeProfile(profile) {
  return {
    host: (profile.host || '').trim(),
    port: toSafePort(profile.port),
    username: (profile.username || '').trim(),
    password: profile.password || '',
    command: '',
    connectTimeoutMs: 10000
  };
}

export function testSsh(profile) {
  return execSsh(profile, 'echo AIDO_SSH_OK');
}

export function execSsh(profile, command) {
  if (!profile || !profile.host || !profile.username || !profile.password) {
    return Promise.resolve({
      code: -1,
      stdout: '',
      stderr: 'SSH 配置不完整，请检查 host、username 和 password。',
      durationMs: 0
    });
  }

  const options = normalizeProfile(profile);
  options.command = command || '';

  return new Promise((resolve, reject) => {
    try {
      const available = AidoSsh.isAvailable ? AidoSsh.isAvailable() : false;
      if (!available) {
        resolve({
          code: -1,
          stdout: '',
          stderr: '当前运行环境没有加载 aido-ssh UTS 模块。调试基座通常不带三方依赖，需要自定义基座或正式打包。',
          durationMs: 0
        });
        return;
      }

      const result = AidoSsh.exec(options);
      resolve({
        code: Number(result.code || 0),
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        durationMs: Number(result.durationMs || 0)
      });
    } catch (error) {
      reject(error);
    }
  });
}
