package uts.sdk.modules.aidoSsh

import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Properties

object SshBridge {

    @JvmStatic
    fun execJson(
        host: String,
        port: Int,
        username: String,
        password: String,
        command: String,
        connectTimeoutMs: Int
    ): String {
        val result = JSONObject()
        var session: Session? = null
        var channel: ChannelExec? = null
        val start = System.currentTimeMillis()

        try {
            val actualPort = if (port > 0) port else 22
            val actualTimeout = if (connectTimeoutMs > 0) connectTimeoutMs else 10000

            val jsch = JSch()
            session = jsch.getSession(username, host, actualPort)
            session.setPassword(password)

            val config = Properties()
            config["StrictHostKeyChecking"] = "no"
            session.setConfig(config)
            session.connect(actualTimeout)

            channel = session.openChannel("exec") as ChannelExec
            channel.setCommand(command)
            channel.setInputStream(null)

            val stdout = ByteArrayOutputStream()
            val stderr = ByteArrayOutputStream()
            channel.setOutputStream(stdout)
            channel.setErrStream(stderr)
            channel.connect(actualTimeout)

            while (!channel.isClosed) {
                Thread.sleep(120)
            }

            result.put("code", channel.exitStatus)
            result.put("stdout", stdout.toString(Charsets.UTF_8.name()))
            result.put("stderr", stderr.toString(Charsets.UTF_8.name()))
            result.put("durationMs", System.currentTimeMillis() - start)
            return result.toString()
        } catch (error: Exception) {
            result.put("code", -1)
            result.put("stdout", "")
            result.put("stderr", error.message ?: error.javaClass.simpleName)
            result.put("durationMs", System.currentTimeMillis() - start)
            return result.toString()
        } finally {
            channel?.disconnect()
            session?.disconnect()
        }
    }
}
