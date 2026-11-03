package com.aido.ssh;

import com.alibaba.fastjson.JSONObject;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

public class AidoSshExecutorModule extends UniModule {

    @UniJSMethod(uiThread = false)
    public void exec(JSONObject options, UniJSCallback callback) {
        JSONObject result = new JSONObject();
        Session session = null;
        ChannelExec channel = null;
        long start = System.currentTimeMillis();

        try {
            String host = options.getString("host");
            int port = options.getIntValue("port");
            String username = options.getString("username");
            String password = options.getString("password");
            String command = options.getString("command");
            int connectTimeoutMs = options.getIntValue("connectTimeoutMs");
            if (connectTimeoutMs <= 0) {
                connectTimeoutMs = 10000;
            }

            JSch jsch = new JSch();
            session = jsch.getSession(username, host, port > 0 ? port : 22);
            session.setPassword(password);

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.connect(connectTimeoutMs);

            channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            channel.setInputStream(null);

            ByteArrayOutputStream stdout = new ByteArrayOutputStream();
            ByteArrayOutputStream stderr = new ByteArrayOutputStream();
            channel.setOutputStream(stdout);
            channel.setErrStream(stderr);
            channel.connect(connectTimeoutMs);

            while (!channel.isClosed()) {
                Thread.sleep(120);
            }

            result.put("code", channel.getExitStatus());
            result.put("stdout", stdout.toString(StandardCharsets.UTF_8.name()));
            result.put("stderr", stderr.toString(StandardCharsets.UTF_8.name()));
            result.put("durationMs", System.currentTimeMillis() - start);
            callback.invoke(result);
        } catch (Exception error) {
            result.put("code", -1);
            result.put("stdout", "");
            result.put("stderr", error.getMessage());
            result.put("durationMs", System.currentTimeMillis() - start);
            callback.invoke(result);
        } finally {
            if (channel != null) {
                channel.disconnect();
            }
            if (session != null) {
                session.disconnect();
            }
        }
    }
}
